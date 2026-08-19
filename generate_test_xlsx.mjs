import XLSX from 'xlsx';

const data = [
  { Sequence: 1, Point: "1", Latitude: -2.58975, Longitude: 31.31061, Description: "Start Tower" },
  { Sequence: 2, Point: "2", Latitude: -2.58930, Longitude: 31.31071, Description: "Tower 2" },
  { Sequence: 3, Point: "3", Latitude: -2.58885, Longitude: 31.31081, Description: "Tower 3" },
  { Sequence: 4, Point: "4", Latitude: -2.58840, Longitude: 31.31091, Description: "Tower 4" },
  { Sequence: 5, Point: "5", Latitude: -2.58795, Longitude: 31.31101, Description: "Tower 5" },
  { Sequence: 6, Point: "6", Latitude: -2.58750, Longitude: 31.31111, Description: "Tower 6" },
  { Sequence: 7, Point: "7", Latitude: -2.58705, Longitude: 31.31121, Description: "Tower 7" },
  { Sequence: 8, Point: "8", Latitude: -2.58660, Longitude: 31.31131, Description: "Tower 8" },
  { Sequence: 9, Point: "9", Latitude: -2.58615, Longitude: 31.31141, Description: "Tower 9" },
  { Sequence: 10, Point: "10", Latitude: -2.58570, Longitude: 31.31151, Description: "Tower 10" },
  { Sequence: 11, Point: "11", Latitude: -2.58525, Longitude: 31.31161, Description: "Tower 11" },
  { Sequence: 12, Point: "12", Latitude: -2.58480, Longitude: 31.31171, Description: "Tower 12" },
  { Sequence: 13, Point: "13", Latitude: -2.58435, Longitude: 31.31181, Description: "Tower 13" },
  { Sequence: 14, Point: "14", Latitude: -2.58390, Longitude: 31.31191, Description: "Tower 14" },
  { Sequence: 15, Point: "15", Latitude: -2.58345, Longitude: 31.31201, Description: "Tower 15" },
  { Sequence: 16, Point: "16", Latitude: -2.58300, Longitude: 31.31211, Description: "Tower 16" },
  { Sequence: 17, Point: "17", Latitude: -2.58255, Longitude: 31.31221, Description: "Tower 17" },
  { Sequence: 18, Point: "18", Latitude: -2.58210, Longitude: 31.31231, Description: "Tower 18" },
  { Sequence: 19, Point: "19", Latitude: -2.58165, Longitude: 31.31241, Description: "Tower 19" },
  { Sequence: 20, Point: "20", Latitude: -2.58120, Longitude: 31.31251, Description: "Tower 20" },
  { Sequence: 21, Point: "21", Latitude: -2.58075, Longitude: 31.31261, Description: "Tower 21" },
  { Sequence: 22, Point: "22", Latitude: -2.58030, Longitude: 31.31271, Description: "Tower 22" },
  { Sequence: 23, Point: "23", Latitude: -2.57985, Longitude: 31.31281, Description: "Tower 23" },
  { Sequence: 24, Point: "24", Latitude: -2.57940, Longitude: 31.31291, Description: "Tower 24" },
  { Sequence: 25, Point: "25", Latitude: -2.57895, Longitude: 31.31301, Description: "Tower 25" },
  { Sequence: 26, Point: "26", Latitude: -2.57850, Longitude: 31.31311, Description: "End Substation" }
];

const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
XLSX.writeFile(wb, "test_1.xlsx");
console.log("Successfully created test_1.xlsx");
