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
const outputJSON = "../disease_time_series.json" // Outputs to the mono-repo root

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
	f, err := excelize.NewReader(reader)
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

	// 3. Setup and sanitize headers (equivalent to df.columns cleanup)
	headerRow := rows[1] // skiprows=1 means index 1 contains our headers
	headers := make([]string, len(headerRow))
	for i, cell := range headerRow {
		cleanHeader := strings.ToLower(strings.ReplaceAll(strings.TrimSpace(cell), " ", "_"))
		headers[i] = cleanHeader
	}

	// Explicitly rename unnamed layout columns
	if len(headers) > 0 { headers[0] = "epi_week" }
	if len(headers) > 1 { headers[1] = "week_dates" }

	// 4. Process data records
	var timeSeriesData []map[string]interface{}

	for r := 2; r < len(rows); r++ {
		row := rows[r]
		// Drop rows without a valid Epi-Week (equivalent to df.dropna(subset=['epi_week']))
		if len(row) == 0 || row[0] == "" {
			continue 
		}

		rowMap := make(map[string]interface{})
		var weekDatesVal string

		for c := 0; c < len(headers); c++ {
			// Explicitly skip unnamed:_2 column (Index 2)
			if c == 2 {
				continue
			}

			var cellValue string
			if c < len(row) {
				cellValue = strings.TrimSpace(row[c])
			}

			headerName := headers[c]

			if headerName == "epi_week" {
				val, _ := strconv.Atoi(cellValue)
				rowMap[headerName] = val
			} else if headerName == "week_dates" {
				weekDatesVal = cellValue
			} else {
				// Convert all disease columns safely to integers. Default fallback to 0.
				val, err := strconv.Atoi(cellValue)
				if err != nil {
					rowMap[headerName] = 0
				} else {
					rowMap[headerName] = val
				}
			}
		}

		// 5. Split week_dates into start_date and end_date (equivalent to string split expand)
		startDate := ""
		endDate := ""
		if weekDatesVal != "" {
			parts := strings.Split(weekDatesVal, " - ")
			if len(parts) == 2 {
				startDate = strings.TrimSpace(parts[0])
				endDate = strings.TrimSpace(parts[1])
			} else {
				startDate = weekDatesVal 
			}
		}
		
		rowMap["start_date"] = startDate
		rowMap["end_date"] = endDate

		timeSeriesData = append(timeSeriesData, rowMap)
	}

	// 6. Convert database to formatted JSON string
	jsonData, err := json.MarshalIndent(timeSeriesData, "", "  ")
	if err != nil {
		fmt.Printf("Error converting data to JSON: %v\n", err)
		return
	}

	// Write directly back to the shared mono-repo destination
	err = os.WriteFile(outputJSON, jsonData, 0644)
	if err != nil {
		fmt.Printf("Error saving file to root folder: %v\n", err)
		return
	}

	fmt.Printf("Successfully processed %d epidemiological weeks using Go!\n", len(timeSeriesData))
}