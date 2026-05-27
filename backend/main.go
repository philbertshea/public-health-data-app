package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/xuri/excelize/v2"
)

const excelURL = "https://isomer-user-content.by.gov.sg/18/29cc3a1e-e24b-423b-b71f-abf56e8ab323/weekly-infectious-disease-bulletin-year-2026.xlsx"
const outputJSON = "../frontend/public/weekly_infectious_bulletin_data.json"

func main() {
	fmt.Println("Starting Go Data Pipeline...")

	// 1. Fetch Excel file over HTTP
	client := &http.Client{}
	req, err := http.NewRequest("GET", excelURL, nil)
	if err != nil {
		fmt.Printf("Error creating request: %v\n", err)
		return
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")

	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Error downloading file: %v\n", err)
		return
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("Error reading response body: %v\n", err)
		return
	}

	// 2. Open spreadsheet from memory bytes
	reader := bytes.NewReader(bodyBytes)
	f, err := excelize.OpenReader(reader)
	if err != nil {
		fmt.Printf("Error parsing excel binary: %v\n", err)
		return
	}

	sheetName := f.GetSheetName(0)
	rows, err := f.GetRows(sheetName)
	if err != nil {
		fmt.Printf("Error reading sheet rows: %v\n", err)
		return
	}

	if len(rows) < 2 {
		fmt.Println("Excel sheet does not contain enough data rows.")
		return
	}

	// 3. Setup and sanitize headers
	headerRow := rows[1]
	headers := make([]string, len(headerRow))
	for i, cell := range headerRow {
		cleanHeader := strings.ToLower(strings.ReplaceAll(strings.TrimSpace(cell), " ", "_"))
		headers[i] = cleanHeader
	}

	if len(headers) > 0 {
		headers[0] = "epi_week"
	}
	if len(headers) > 1 {
		headers[1] = "week_dates"
	}

	// 4. Process data records
	var timeSeriesData []json.RawMessage

	for r := 2; r < len(rows); r++ {
		row := rows[r]

		// Basic safety check for malformed structural rows
		if len(row) < 2 {
			continue
		}

		// If core identifier fields are completely missing, drop the row
		if strings.TrimSpace(row[0]) == "" || strings.TrimSpace(row[1]) == "" {
			continue
		}

		// Track whether this row contains *any* disease data points
		hasDiseaseData := false

		var epiWeekVal int
		var startDateVal string
		var endDateVal string

		diseaseMap := make(map[string]int)

		for c := 0; c < len(headers); c++ {
			if c == 2 {
				continue // Skip unnamed:_2
			}

			var cellValue string
			if c < len(row) {
				cellValue = strings.TrimSpace(row[c])
			}

			headerName := headers[c]
			if headerName == "" {
				continue
			}

			switch headerName {
			case "epi_week":
				epiWeekVal, _ = strconv.Atoi(cellValue)
			case "week_dates":
				parts := strings.Split(cellValue, " - ")
				if len(parts) == 2 {
					startDateVal = strings.TrimSpace(parts[0])
					endDateVal = strings.TrimSpace(parts[1])
				} else {
					startDateVal = cellValue
				}
			default:
				// If a disease column has a value, mark this row as active data
				if cellValue != "" {
					hasDiseaseData = true
					val, err := strconv.Atoi(cellValue)
					if err != nil {
						diseaseMap[headerName] = 0
					} else {
						diseaseMap[headerName] = val
					}
				} else {
					// Fallback default for future weeks or missing records
					diseaseMap[headerName] = 0
				}
			}
		}

		// df.dropna() equivalent for placeholder rows:
		// If the row only has week info but completely lacks disease counts, skip it
		if !hasDiseaseData {
			continue
		}

		// 5. Build explicit JSON string to force key order
		diseaseJSONString, _ := json.Marshal(diseaseMap)
		diseaseClean := strings.TrimSuffix(strings.TrimPrefix(string(diseaseJSONString), "{"), "}")

		var formattedItem string
		if diseaseClean == "" {
			formattedItem = fmt.Sprintf(`{"epi_week": %d, "start_date": "%s", "end_date": "%s"}`, epiWeekVal, startDateVal, endDateVal)
		} else {
			formattedItem = fmt.Sprintf(`{"epi_week": %d, "start_date": "%s", "end_date": "%s", %s}`, epiWeekVal, startDateVal, endDateVal, diseaseClean)
		}

		timeSeriesData = append(timeSeriesData, json.RawMessage(formattedItem))
	}

	// 6. Format array list with spacing
	var finalBuffer bytes.Buffer
	finalBuffer.WriteString("[\n")
	for i, item := range timeSeriesData {
		var formattedJSON bytes.Buffer
		json.Indent(&formattedJSON, item, "  ", "  ")
		finalBuffer.WriteString("  ")
		finalBuffer.WriteString(formattedJSON.String())
		if i < len(timeSeriesData)-1 {
			finalBuffer.WriteString(",\n")
		}
	}
	finalBuffer.WriteString("\n]")

	// Write directly back to the shared mono-repo destination
	err = os.WriteFile(outputJSON, finalBuffer.Bytes(), 0644)
	if err != nil {
		fmt.Printf("Error saving file to root folder: %v\n", err)
		return
	}

	fmt.Printf("Successfully processed %d epidemiological weeks using Go!\n", len(timeSeriesData))
}
