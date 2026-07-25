const SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1BdqSEVm-ekZmkrBkpCLCv5aM_YXtw4m9WzoZykmc7UU/edit";

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL).getActiveSheet();
    const data = JSON.parse(e.postData.contents);
    
    // Check if header row is missing, and add it
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Timestamp",
        "Action Type",
        "Agent Name",
        "Mobile Number",
        "District",
        "UTR Number",
        "Amount (₹)",
        "Welcome Code",
        "System ID"
      ]);
      // Bold the header
      sheet.getRange(1, 1, 1, 9).setFontWeight("bold");
    }

    if (data.type === 'REGISTRATION') {
      sheet.appendRow([
        new Date().toLocaleString(),
        "REGISTRATION",
        data.name || "",
        data.mobile || "",
        data.district || "",
        "", // UTR
        "", // Amount
        "", // Welcome Code
        data.systemId || ""
      ]);
    } else if (data.type === 'PAYMENT') {
      sheet.appendRow([
        new Date().toLocaleString(),
        "PAYMENT",
        data.name || "",
        data.mobile || "",
        data.district || "",
        data.utr || "",
        data.amount || "",
        data.welcomeCode || "",
        data.systemId || ""
      ]);
    }

    return ContentService.createTextOutput(JSON.stringify({"status": "success"}))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
