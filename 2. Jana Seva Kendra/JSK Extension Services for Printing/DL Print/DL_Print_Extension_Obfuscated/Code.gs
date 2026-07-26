const SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1BdqSEVm-ekZmkrBkpCLCv5aM_YXtw4m9WzoZykmc7UU/edit";

function doPost(e) {
  try {
    const ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);

    // ── Logs Sheet ────────────────────────────────────────────────────────────
    let logSheet = ss.getSheetByName("Logs");
    if (!logSheet) {
      logSheet = ss.getActiveSheet();
      logSheet.setName("Logs");
    }
    if (logSheet.getLastRow() === 0) {
      logSheet.appendRow(["Timestamp", "Action Type", "Agent Name", "Mobile Number", "District", "UTR Number", "Amount (₹)", "Welcome Code", "System ID", "Email"]);
      logSheet.getRange(1, 1, 1, 10).setFontWeight("bold");
    }

    // ── Wallets Sheet ─────────────────────────────────────────────────────────
    let walletSheet = ss.getSheetByName("Wallets");
    if (!walletSheet) {
      walletSheet = ss.insertSheet("Wallets");
      walletSheet.appendRow(["Email", "System ID", "Agent Name", "Mobile", "District", "Balance", "Welcome Claimed"]);
      walletSheet.getRange(1, 1, 1, 7).setFontWeight("bold");
    }

    // ── Payments Sheet (NEW) ──────────────────────────────────────────────────
    let paymentSheet = ss.getSheetByName("Payments");
    if (!paymentSheet) {
      paymentSheet = ss.insertSheet("Payments");
      paymentSheet.appendRow(["Timestamp", "Agent Name", "Mobile Number", "District", "Email", "System ID", "Amount Paid (₹)", "Points Added", "UTR Number", "Status"]);
      paymentSheet.getRange(1, 1, 1, 10).setFontWeight("bold");
    }

    const data       = JSON.parse(e.postData.contents);
    const email      = (data.email    || "").trim().toLowerCase();
    const systemId   = (data.systemId || "").trim();
    const actionType = data.type || "REGISTRATION";

    // ── Find Wallet Row ───────────────────────────────────────────────────────
    let walletData = walletSheet.getDataRange().getValues();
    let rowIndex   = -1;

    // Match by Email first, then System ID, then Mobile (for payments)
    for (let i = 1; i < walletData.length; i++) {
      const rowEmail    = String(walletData[i][0]).trim().toLowerCase();
      const rowSystemId = String(walletData[i][1]).trim();
      const rowMobile   = String(walletData[i][3]).trim();

      if (email && rowEmail === email) {
        rowIndex = i + 1;
        break;
      }
      if (systemId && systemId !== "PAYU_AUTO" && rowSystemId === systemId && rowIndex === -1) {
        rowIndex = i + 1;
      }
      if (systemId === "PAYU_AUTO" && !email && data.mobile && String(data.mobile).trim() !== "Unknown" && rowMobile === String(data.mobile).trim() && rowIndex === -1) {
        rowIndex = i + 1;
      }
    }

    let currentBalance = 0;
    let welcomeClaimed = false;
    let agentName      = data.name     || "";
    let mobile         = data.mobile   || "";
    let district       = data.district || "";

    if (rowIndex !== -1) {
      agentName      = walletData[rowIndex - 1][2] || agentName;
      mobile         = walletData[rowIndex - 1][3] || mobile;
      district       = walletData[rowIndex - 1][4] || district;
      currentBalance = Number(walletData[rowIndex - 1][5]) || 0;
      welcomeClaimed = walletData[rowIndex - 1][6] === true ||
                       String(walletData[rowIndex - 1][6]).toLowerCase() === "true";
    } else if (systemId || email) {
      walletSheet.appendRow([email, systemId, agentName, mobile, district, 0, false]);
      rowIndex = walletSheet.getLastRow();
    }

    // ── GET_AGENT ─────────────────────────────────────────────────────────────
    if (actionType === "GET_AGENT") {
      if (rowIndex !== -1 && agentName) {
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          data: {
            agentName:      agentName,
            mobile:         mobile,
            district:       district,
            balance:        currentBalance,
            welcomeClaimed: welcomeClaimed
          }
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: "No agent found for this email."
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // ── GET_WALLET ────────────────────────────────────────────────────────────
    if (actionType === "GET_WALLET") {
      return ContentService.createTextOutput(JSON.stringify({
        success:        true,
        status:         "success",
        balance:        currentBalance,
        welcomeClaimed: welcomeClaimed,
        agentName:      agentName,
        mobile:         mobile,
        district:       district,
        data: {
          agentName:      agentName,
          mobile:         mobile,
          district:       district,
          balance:        currentBalance,
          welcomeClaimed: welcomeClaimed
        }
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ── UPDATE_WALLET / REGISTRATION / PAYMENT ────────────────────────────────
    if (actionType === "UPDATE_WALLET" || actionType === "REGISTRATION" || actionType === "PAYMENT") {
      let pointsToAdd = Number(data.pointsToAdd) || 0;
      let amountPaid = Number(data.amount) || 0;
      
      // Automatically calculate points if the extension forgot to send pointsToAdd
      if (pointsToAdd === 0 && amountPaid > 0) {
        pointsToAdd = amountPaid;
        if (amountPaid >= 1000) { pointsToAdd = amountPaid * 4; } 
        else if (amountPaid >= 500) { pointsToAdd = amountPaid * 2; }
      }

      if (data.welcomeCode && String(data.welcomeCode).toLowerCase() === "welcometojskfamily" && !welcomeClaimed) {
        welcomeClaimed = true;
        walletSheet.getRange(rowIndex, 7).setValue(true);
      }

      currentBalance += pointsToAdd;

      walletSheet.getRange(rowIndex, 1, 1, 6).setValues([[
        email      || (rowIndex !== -1 ? walletData[rowIndex - 1][0] : ""),
        systemId   || (rowIndex !== -1 ? walletData[rowIndex - 1][1] : ""),
        data.name  || agentName,
        data.mobile   || mobile,
        data.district || district,
        currentBalance
      ]]);

      logSheet.appendRow([
        new Date().toLocaleString(),
        actionType,
        data.name     || agentName,
        data.mobile   || mobile,
        data.district || district,
        data.utr      || "",
        data.amount   || 0,
        data.welcomeCode || "",
        systemId   || (rowIndex !== -1 ? walletData[rowIndex - 1][1] : ""),
        email      || (rowIndex !== -1 ? walletData[rowIndex - 1][0] : "")
      ]);

      // NEW: Log directly to dedicated Payments sheet if an amount was paid
      if ((actionType === "PAYMENT" || actionType === "UPDATE_WALLET") && (data.amount > 0 || pointsToAdd > 0)) {
        paymentSheet.appendRow([
          new Date().toLocaleString(),
          data.name     || agentName,
          data.mobile   || mobile,
          data.district || district,
          email      || (rowIndex !== -1 ? walletData[rowIndex - 1][0] : ""),
          systemId   || (rowIndex !== -1 ? walletData[rowIndex - 1][1] : ""),
          data.amount   || 0,
          pointsToAdd,
          data.utr      || "",
          "Success"
        ]);
      }

      return ContentService.createTextOutput(JSON.stringify({
        success:        true,
        status:         "success",
        balance:        currentBalance,
        welcomeClaimed: welcomeClaimed,
        data: {
          agentName:      data.name  || agentName,
          mobile:         data.mobile   || mobile,
          district:       data.district || district,
          balance:        currentBalance,
          welcomeClaimed: welcomeClaimed
        }
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ── DEDUCT_WALLET ─────────────────────────────────────────────────────────
    if (actionType === "DEDUCT_WALLET") {
      let pointsToDeduct = Number(data.pointsToDeduct) || 25;
      currentBalance    -= pointsToDeduct;
      walletSheet.getRange(rowIndex, 6).setValue(currentBalance);

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
        success: true,
        status:  "success",
        balance: currentBalance
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ── Default response ──────────────────────────────────────────────────────
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      status:  "success",
      balance: currentBalance
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      status:  "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
