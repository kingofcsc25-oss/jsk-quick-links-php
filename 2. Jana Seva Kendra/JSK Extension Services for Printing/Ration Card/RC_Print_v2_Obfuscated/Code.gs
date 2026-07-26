// Google Sheets Integration for Agent Data
// Web App URL: https://script.google.com/macros/s/AKfycbxqfKn1jwBNUA9uoLjZl8pYRrNHajK0OSYaxCO2XoW2pYz3vQ4TjJFRqqr-77x5cc8ZsA/exec
// Library URL: https://script.google.com/macros/library/d/18r1F6CDw52_vR-z5KaFARr__hLTdBHF3-z9ZUjV1KVITwqebuHjbBKaq/1

const SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1mTEnFZ6WA_CHF2jmzcbOoSRIdxjfnBmraMrYbHhZ1kQ/edit";

function doGet(e) {
  try {
    const sheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL).getActiveSheet();
    const action = e.parameter.action;
    const email = e.parameter.email;
    
    if (action === 'checkUser' && email) {
      const data = sheet.getDataRange().getValues();
      let registered = false;
      let welcomeCodeUsed = false;
      let agentDetails = null;
      
      const searchEmail = email.toString().trim().toLowerCase();
      
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const rowEmail = row[7] ? row[7].toString().trim().toLowerCase() : "";
        if (rowEmail === searchEmail) {
          registered = true;
          
          // Populate details from the registration record
          if (!agentDetails && row[2]) {
            agentDetails = {
              name: row[2],
              rcNumber: row[3],
              mobile: row[4],
              division: row[5],
              walletBalance: (row[10] !== undefined && row[10] !== "") ? Number(row[10]) : undefined,
              packageExpiry: (row[11] !== undefined && row[11] !== "") ? Number(row[11]) : undefined,
              packageType: (row[12] !== undefined && row[12] !== "") ? row[12].toString() : undefined,
              packagePrintCounts: (row[13] !== undefined && row[13] !== "") ? row[13].toString() : undefined
            };
          }
          
          const actionType = row[1];
          if (actionType === 'WELCOME_CODE_ACTIVATION') {
            welcomeCodeUsed = true;
          }
        }
      }
      
      const response = {
        status: "success",
        registered: registered,
        welcomeCodeUsed: welcomeCodeUsed,
        agentDetails: agentDetails
      };
      
      return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: "Invalid action or missing email"}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL).getActiveSheet();
    const data = JSON.parse(e.postData.contents);
    
    // Check if header row is missing, and add it (14 columns total)
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Timestamp",
        "Action Type",
        "Agent Name",
        "Agent RC Number",
        "Mobile Number",
        "Division/District",
        "System ID",
        "Chrome Email ID",
        "Welcome Code / Package Name",
        "Amount / Points",
        "Wallet Points",
        "Package Expiry",
        "Package Type",
        "Package Print Counts"
      ]);
      // Bold the header
      sheet.getRange(1, 1, 1, 14).setFontWeight("bold");
    }

    const actionType = data.type || "REGISTRATION";
    const chromeEmail = data.chromeEmail || "";

    if (actionType === 'REGISTRATION') {
      const dataValues = sheet.getDataRange().getValues();
      let rowToUpdate = -1;
      const searchRc = (data.rcNumber || "").toString().trim();
      const searchEmail = chromeEmail.toString().trim().toLowerCase();
      
      for (let i = 1; i < dataValues.length; i++) {
        const row = dataValues[i];
        const rowRc = row[3] ? row[3].toString().trim() : "";
        const rowEmail = row[7] ? row[7].toString().trim().toLowerCase() : "";
        
        // Match by RC number or Chrome Email ID
        if ((searchRc && rowRc === searchRc) || (searchEmail && rowEmail === searchEmail)) {
          rowToUpdate = i + 1; // 1-indexed row number
          break;
        }
      }
      
      if (rowToUpdate !== -1) {
        sheet.getRange(rowToUpdate, 1).setValue(new Date().toLocaleString());
        sheet.getRange(rowToUpdate, 2).setValue("REGISTRATION");
        sheet.getRange(rowToUpdate, 3).setValue(data.name || "");
        sheet.getRange(rowToUpdate, 4).setValue(data.rcNumber || "");
        sheet.getRange(rowToUpdate, 5).setValue(data.mobile || "");
        sheet.getRange(rowToUpdate, 6).setValue(data.division || "");
        sheet.getRange(rowToUpdate, 7).setValue(data.systemId || "");
        sheet.getRange(rowToUpdate, 8).setValue(chromeEmail);
        
        // Save points and package info if provided in request
        if (data.walletBalance !== undefined && data.walletBalance !== null && data.walletBalance !== "") {
          sheet.getRange(rowToUpdate, 11).setValue(data.walletBalance);
        }
        if (data.packageExpiry !== undefined && data.packageExpiry !== null && data.packageExpiry !== "") {
          sheet.getRange(rowToUpdate, 12).setValue(data.packageExpiry);
        }
        if (data.packageType !== undefined && data.packageType !== null && data.packageType !== "") {
          sheet.getRange(rowToUpdate, 13).setValue(data.packageType);
        }
        if (data.packagePrintCounts !== undefined && data.packagePrintCounts !== null && data.packagePrintCounts !== "") {
          sheet.getRange(rowToUpdate, 14).setValue(data.packagePrintCounts);
        }
      } else {
        sheet.appendRow([
          new Date().toLocaleString(),
          "REGISTRATION",
          data.name || "",
          data.rcNumber || "",
          data.mobile || "",
          data.division || "",
          data.systemId || "",
          chromeEmail,
          "", // Welcome Code / Package Name
          "", // Amount / Points
          data.walletBalance !== undefined ? data.walletBalance : "",
          data.packageExpiry !== undefined ? data.packageExpiry : "",
          data.packageType !== undefined ? data.packageType : "",
          data.packagePrintCounts !== undefined ? data.packagePrintCounts : ""
        ]);
      }
    } else if (actionType === 'WELCOME_CODE_ACTIVATION') {
      sheet.appendRow([
        new Date().toLocaleString(),
        "WELCOME_CODE_ACTIVATION",
        data.name || "",
        data.rcNumber || "",
        data.mobile || "",
        data.division || "",
        data.systemId || "",
        chromeEmail,
        data.utrNumber || "", // Logs the welcome code applied
        "+25 PTS"             // Points awarded
      ]);
    } else if (actionType === 'POINTS_TO_PACKAGE_CONVERSION') {
      sheet.appendRow([
        new Date().toLocaleString(),
        "POINTS_TO_PACKAGE_CONVERSION",
        data.name || "",
        data.rcNumber || "",
        data.mobile || "",
        data.division || "",
        data.systemId || "",
        chromeEmail,
        data.packageName || "",
        `-${data.amount} PTS`
      ]);
    } else if (actionType === 'PACKAGE_TO_POINTS_CONVERSION') {
      sheet.appendRow([
        new Date().toLocaleString(),
        "PACKAGE_TO_POINTS_CONVERSION",
        data.name || "",
        data.rcNumber || "",
        data.mobile || "",
        data.division || "",
        data.systemId || "",
        chromeEmail,
        data.packageName || "",
        `+${data.amount} PTS`
      ]);
    }

    return ContentService.createTextOutput(JSON.stringify({"status": "success"}))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
