const SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1BdqSEVm-ekZmkrBkpCLCv5aM_YXtw4m9WzoZykmc7UU/edit";

function doPost(e) {
  try {
    const ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
    let logSheet = ss.getSheetByName("Logs");
    if (!logSheet) {
        logSheet = ss.getActiveSheet(); // Fallback to first sheet
        logSheet.setName("Logs");
    }
    
    // Check if header row is missing in Logs
    if (logSheet.getLastRow() === 0) {
      logSheet.appendRow(["Timestamp", "Action Type", "Agent Name", "Mobile Number", "District", "UTR Number", "Amount (₹)", "Welcome Code", "System ID", "Email"]);
      logSheet.getRange(1, 1, 1, 10).setFontWeight("bold");
    }

    let walletSheet = ss.getSheetByName("Wallets");
    if (!walletSheet) {
        walletSheet = ss.insertSheet("Wallets");
        walletSheet.appendRow(["Email", "System ID", "Agent Name", "Mobile", "District", "Balance", "Welcome Claimed"]);
        walletSheet.getRange(1, 1, 1, 7).setFontWeight("bold");
    }

    const data = JSON.parse(e.postData.contents);
    const email = data.email || "";
    const systemId = data.systemId || "";
    const actionType = data.type || "REGISTRATION";
    
    // Find Wallet Row
    let walletData = walletSheet.getDataRange().getValues();
    let rowIndex = -1;
    
    // Match by System ID, and preferably Email if provided
    for (let i = 1; i < walletData.length; i++) {
        if (walletData[i][1] === systemId) {
            rowIndex = i + 1; // +1 because rows are 1-indexed
            break;
        }
    }

    let currentBalance = 0;
    let welcomeClaimed = false;
    let agentName = data.name || "";
    let mobile = data.mobile || "";
    let district = data.district || "";

    if (rowIndex !== -1) {
        agentName = walletData[rowIndex - 1][2] || agentName;
        mobile = walletData[rowIndex - 1][3] || mobile;
        district = walletData[rowIndex - 1][4] || district;
        currentBalance = Number(walletData[rowIndex - 1][5]) || 0;
        welcomeClaimed = walletData[rowIndex - 1][6] === true || String(walletData[rowIndex - 1][6]).toLowerCase() === 'true';
    } else if (systemId) {
        // Create new row
        walletSheet.appendRow([email, systemId, agentName, mobile, district, 0, false]);
        rowIndex = walletSheet.getLastRow();
    }

    if (actionType === 'GET_WALLET') {
        return ContentService.createTextOutput(JSON.stringify({
            "status": "success",
            "balance": currentBalance,
            "welcomeClaimed": welcomeClaimed,
            "agentName": agentName,
            "mobile": mobile,
            "district": district
        })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (actionType === 'UPDATE_WALLET' || actionType === 'REGISTRATION' || actionType === 'PAYMENT') {
        let pointsToAdd = Number(data.pointsToAdd) || 0;
        
        if (data.welcomeCode && String(data.welcomeCode).toLowerCase() === "welcometojskfamily" && !welcomeClaimed) {
            welcomeClaimed = true;
            walletSheet.getRange(rowIndex, 7).setValue(true);
        }

        currentBalance += pointsToAdd;
        
        // Update balance and details
        walletSheet.getRange(rowIndex, 1, 1, 6).setValues([[email || walletData[rowIndex - 1][0], systemId, data.name || agentName, data.mobile || mobile, data.district || district, currentBalance]]);
        
        // Log transaction
        logSheet.appendRow([
            new Date().toLocaleString(),
            actionType,
            data.name || agentName,
            data.mobile || mobile,
            data.district || district,
            data.utr || "",
            data.amount || 0,
            data.welcomeCode || "",
            systemId,
            email
        ]);
        
        return ContentService.createTextOutput(JSON.stringify({
            "status": "success",
            "balance": currentBalance,
            "welcomeClaimed": welcomeClaimed
        })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (actionType === 'DEDUCT_WALLET') {
        let pointsToDeduct = Number(data.pointsToDeduct) || 25;
        currentBalance -= pointsToDeduct;
        walletSheet.getRange(rowIndex, 6).setValue(currentBalance);
        
        // Log deduction
        logSheet.appendRow([
            new Date().toLocaleString(),
            "PRINT_DEDUCTION",
            agentName,
            mobile,
            district,
            data.dlNumber || "",
            -pointsToDeduct,
            "",
            systemId,
            email
        ]);
        
        return ContentService.createTextOutput(JSON.stringify({
            "status": "success",
            "balance": currentBalance
        })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({"status": "success", "balance": currentBalance})).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": error.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}
