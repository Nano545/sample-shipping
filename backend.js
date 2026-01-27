/**
 * Sample Request Manager - Backend (Google Apps Script)
 * 
 * 1. Create a Google Sheet.
 * 2. Rename the first sheet to 'Orders'.
 * 3. Set header row (Row 1): id, timestamp, requester, address, targetDate, items, status, remarks
 * 4. Paste this code into Extensions > Apps Script.
 * 5. Deploy as Web App (Execute as: Me, Who has access: Anyone).
 */

const SHEET_NAME = 'Orders';
const PRODUCTS_SHEET_NAME = 'Products';

function doGet(e) {
    const page = e.parameter.page;
    const action = e.parameter.action;

    // API Mode (if action is present)
    // API Mode (if action is present)
    if (action) {
        return handleApiRequest(e);
    }

    // HTML Rendering Mode
    let templateName = 'requester'; // Default to Requester view
    if (page === 'admin') {
        templateName = 'admin';
    }

    return HtmlService.createTemplateFromFile(templateName)
        .evaluate()
        .setTitle('Sample Request Manager')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// --- CONFIGURATION ---
const NOTIFICATION_EMAIL = 'ogaki@ogawasyouyaku.co.jp'; // Enter email address here (e.g., 'admin@example.com')
const ENABLE_EMAIL_NOTIFICATION = true;
const ADMIN_PIN = '3245';

// Requester Email Mapping (All set to same email for testing/initial phase)
const REQUESTER_EMAILS = {
    '東方': 'ogaki@ogawasyouyaku.co.jp',
    '山本': 'ogaki@ogawasyouyaku.co.jp',
    '竹田': 'takeda.k@ogawasyouyaku.co.jp',
    '小川': 'ogaki@ogawasyouyaku.co.jp',
    '岡本': 'ogaki@ogawasyouyaku.co.jp'
};

// --- Notification Logic ---
function sendNotification(order) {
    if (!ENABLE_EMAIL_NOTIFICATION) return;

    // Email Notification
    if (NOTIFICATION_EMAIL) {
        const subject = `【SampleRequest】新規注文: ${order.requester}様`;
        const body = `
新規のサンプル依頼がありました。

■注文ID: ${order.id}
■依頼者: ${order.requester}
■納品先: ${order.targetName} (${order.address})
■納品指定日: ${order.targetDate} ${order.timeSlot || ''}
■商品:
${order.items.map(i => `・${i.name} x${i.qty}`).join('\n')}

■備考:
${order.remarks || 'なし'}

管理画面を確認して手配を進めます。
https://nano545.github.io/sample-shipping/admin.html
        `.trim();

        try {
            MailApp.sendEmail(NOTIFICATION_EMAIL, subject, body);
        } catch (e) {
            console.error('Email Notification Failed:', e);
        }
    }
    // Chat notification removed as per request
}

// Support for <?!= include('filename'); ?>
function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// --- Zipcloud API Configuration (Replaces Japan Post API) ---
const ZIPCLOUD_API_BASE = 'https://zipcloud.ibsnet.co.jp/api/search';

function searchAddressByZipcloud(zip) {
    // API Format: ?zipcode={code}
    const url = `${ZIPCLOUD_API_BASE}?zipcode=${zip}`;

    try {
        const response = UrlFetchApp.fetch(url, {
            method: 'get',
            muteHttpExceptions: true
        });

        if (response.getResponseCode() !== 200) {
            throw new Error(`API Error: ${response.getResponseCode()}`);
        }

        const json = JSON.parse(response.getContentText());
        if (json.status !== 200) {
            // Zipcloud returns status 200 even on not found, but status field in JSON indicates logic
            // If status != 200, it might be an error
            return null;
        }
        return json;
    } catch (e) {
        console.error('Zipcloud Error:', e);
        throw e;
    }
}

// Separate API logic
function handleApiRequest(e) {
    try {
        const action = e.parameter.action;

        // New Action: Address Search
        if (action === 'searchAddress') {
            const zip = e.parameter.zip;
            if (!zip) return createJsonResponse({ status: 'error', message: 'No zip code provided' });

            try {
                const result = searchAddressByZipcloud(zip);

                // Zipcloud returns results: null if not found
                if (!result || !result.results) {
                    return createJsonResponse({ status: 'success', found: false });
                }

                // Extract address from result.results[0]
                // Zipcloud fields: address1 (Pref), address2 (City), address3 (Town)
                const addr = result.results[0];
                const fullAddr = `${addr.address1}${addr.address2}${addr.address3}`;

                return createJsonResponse({
                    status: 'success',
                    found: true,
                    address: fullAddr,
                    details: {
                        prefecture: addr.address1,
                        city: addr.address2,
                        town: addr.address3
                    }
                });
            } catch (err) {
                return createJsonResponse({ status: 'error', message: err.toString() });
            }
        }

        if (action === 'products') {
            const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PRODUCTS_SHEET_NAME);
            if (!sheet) {
                return createJsonResponse({ status: 'error', message: 'Products sheet not found' });
            }
            const data = sheet.getDataRange().getValues();
            const products = [];
            for (let i = 1; i < data.length; i++) {
                if (!data[i][0]) continue;
                products.push({
                    jan: String(data[i][0]),
                    name: String(data[i][1]),
                    raw_material: String(data[i][2] || ''),
                    organic_type: String(data[i][3] || '')
                });
            }
            return createJsonResponse({ status: 'success', products: products });

        } else if (action === 'read') {
            const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
            if (!sheet) return createJsonResponse({ status: 'success', items: [] });

            const data = sheet.getDataRange().getValues();
            const orders = [];
            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                if (!row[0]) continue;
                orders.push({
                    id: row[0],
                    timestamp: row[1],
                    requester: row[2],
                    zip: row[3],
                    address: row[4],
                    targetName: row[5],
                    phone: row[6],
                    targetDate: row[7],
                    timeSlot: row[8],
                    items: parseItems(row[9]),
                    status: row[10],
                    remarks: row[11] || '',
                    shipmentDate: row[12] ? AppUtils_formatDate(row[12]) : '',
                    shipmentStaff: row[13] || '',
                    trackingNumber: row[14] || ''
                });
            }
            return createJsonResponse({ status: 'success', items: orders });

        } else if (action === 'myOrders') {
            const requesterName = e.parameter.requester;
            if (!requesterName) return createJsonResponse({ status: 'error', message: 'Requester name required' });

            const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
            if (!sheet) return createJsonResponse({ status: 'success', items: [] });

            const data = sheet.getDataRange().getValues();
            const orders = [];
            // Iterate from bottom to top for latest first, or just sort later. Standard top-down is fine.
            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                if (!row[0] || row[2] !== requesterName) continue;

                orders.push({
                    id: row[0],
                    timestamp: row[1], // Date object
                    targetName: row[5],
                    zip: row[3],
                    address: row[4],
                    phone: row[6],
                    targetDate: row[7],
                    items: parseItems(row[9]),
                    status: row[10],
                    shipmentDate: row[12] ? AppUtils_formatDate(row[12]) : '',
                    trackingNumber: row[14] || ''
                });
            }
            // Sort by timestamp desc
            orders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            return createJsonResponse({ status: 'success', items: orders });
        }

        return createJsonResponse({ status: 'error', message: 'Invalid GET action' });

    } catch (err) {
        return createJsonResponse({ status: 'error', message: err.toString() });
    }
}

/**
 * POSTリクエスト処理 (Web App / API Endpoint)
 * 
 * 排他制御(LockService)を使用して、同時アクセスによるデータの整合性ズレを防止します。
 * 主なアクション:
 * - create: 新規注文の作成
 * - updateStatus: 注文ステータスの更新（発送処理含む）
 */
function doPost(e) {
    const lock = LockService.getScriptLock();
    lock.tryLock(10000);

    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
        if (!sheet) throw new Error('Sheet "Orders" not found');

        const data = JSON.parse(e.postData.contents);
        const action = data.action;
        let result = {};

        if (action === 'create') {
            const id = Utilities.getUuid();
            const timestamp = new Date();
            const itemsJson = JSON.stringify(data.items || []);

            sheet.appendRow([
                id, timestamp, data.requester, data.zip || '', data.address,
                data.targetName || '', data.phone || '', data.targetDate,
                data.timeSlot || '', itemsJson, '未処理', data.remarks || ''
            ]);

            // Fire Notification (Admin)
            const newOrder = {
                id: id,
                requester: data.requester,
                targetName: data.targetName || '',
                address: data.address,
                targetDate: data.targetDate,
                timeSlot: data.timeSlot,
                items: data.items || [],
                remarks: data.remarks
            };
            sendNotification(newOrder);

            // Fire Confirmation (Requester)
            sendRequesterOrderConfirmation(newOrder);

            result = { status: 'success', id: id, message: 'Order created' };

        } else if (action === 'updateStatus') {
            const id = data.id;
            const newStatus = data.status;
            const range = sheet.getDataRange();
            const values = range.getValues();
            let found = false;

            for (let i = 1; i < values.length; i++) {
                if (values[i][0] === id) {
                    sheet.getRange(i + 1, 11).setValue(newStatus); // Status is Col 11

                    // Trigger Notification if status became '発送済'
                    if (newStatus === '発送済') {
                        // Update Sheet with Shipment Details
                        const shipmentDate = data.shipmentDate ? new Date(data.shipmentDate) : new Date();
                        const staff = data.shipmentStaff || '';
                        const tracking = data.trackingNumber || '';

                        // M=13, N=14, O=15
                        sheet.getRange(i + 1, 13).setValue(shipmentDate);
                        sheet.getRange(i + 1, 14).setValue(staff);
                        sheet.getRange(i + 1, 15).setValue(tracking);

                        const row = values[i];
                        const orderDetails = {
                            id: row[0],
                            timestamp: row[1],
                            requester: row[2],
                            zip: row[3],
                            address: row[4],
                            targetName: row[5],
                            phone: row[6],
                            targetDate: row[7],
                            timeSlot: row[8],
                            items: parseItems(row[9]),
                            status: newStatus,
                            remarks: row[11] || '',
                            // Use provided data for email
                            shipmentDate: data.shipmentDate || '',
                            shipmentStaff: staff,
                            trackingNumber: tracking
                        };
                        sendRequesterNotification(orderDetails);
                    }

                    found = true;
                    break;
                }
            }
            result = found ? { status: 'success' } : { status: 'error', message: 'ID not found' };
        } else if (action === 'auth') {
            const inputPin = data.pin;
            if (inputPin === ADMIN_PIN) {
                result = { status: 'success' };
            } else {
                result = { status: 'error', message: 'Invalid PIN' };
            }
        } else {
            result = { status: 'error', message: 'Invalid POST action' };
        }
        return createJsonResponse(result);

    } catch (err) {
        return createJsonResponse({ status: 'error', message: err.toString() });
    } finally {
        lock.releaseLock();
    }
}

function parseItems(jsonString) {
    try { return JSON.parse(jsonString); } catch (e) { return []; }
}

function createJsonResponse(data) {
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}



/**
 * 依頼者への通知メール送信
 * 
 * @param {Object} order - 注文オブジェクト
 * 発送情報（担当者、送り状番号）が存在する場合はメール本文に追加します。
 */
function sendRequesterNotification(order) {
    if (!ENABLE_EMAIL_NOTIFICATION) return;

    const requesterEmail = REQUESTER_EMAILS[order.requester];
    if (!requesterEmail) {
        console.warn(`No email defined for requester: ${order.requester}`);
        return;
    }

    const subject = `【SampleRequest】発送完了のお知らせ (注文ID: ${order.id.substring(0, 8)}...)`;

    // Optional Shipping Info
    let shippingInfoBlock = '';
    if (order.shipmentStaff || order.trackingNumber) {
        shippingInfoBlock = '\n■配送情報\n';
        if (order.shipmentStaff) shippingInfoBlock += `担当者: ${order.shipmentStaff}\n`;
        if (order.trackingNumber) shippingInfoBlock += `送り状番号: ${order.trackingNumber}\n`;
    }

    const body = `
${order.requester} 様

お疲れ様です。
ご依頼いただきました以下のサンプルを発送いたしました。
${shippingInfoBlock}
■納品先:
${order.targetName} 様
〒${order.zip} ${order.address}
電話: ${order.phone}

■納品指定日: ${AppUtils_formatDate(order.targetDate)} ${order.timeSlot || ''}
${order.shipmentDate ? `■発送日: ${AppUtils_formatDate(order.shipmentDate)}\n` : ''}
■発送商品:
${order.items.map(i => `・${i.name} x${i.qty}`).join('\n')}

■備考:
${order.remarks || 'なし'}

ご確認よろしくお願いいたします。
(本メールは自動送信です)
    `.trim();

    try {
        MailApp.sendEmail(requesterEmail, subject, body);
        // console.log(`[Requester Notification] Sent to ${requesterEmail}`); // Removed for production
    } catch (e) {
        console.error('[Requester Notification] Failed:', e);
    }
}

// Helper for date formatting in GAS (mimics client-side AppUtils)
function AppUtils_formatDate(dateStr) {
    if (!dateStr) return '';
    return Utilities.formatDate(new Date(dateStr), Session.getScriptTimeZone(), 'yyyy/MM/dd');
}

/**
 * 依頼者への注文受付確認メール送信
 * 
 * @param {Object} order - 注文オブジェクト
 */
function sendRequesterOrderConfirmation(order) {
    if (!ENABLE_EMAIL_NOTIFICATION) return;

    const requesterEmail = REQUESTER_EMAILS[order.requester];
    if (!requesterEmail) return;

    const subject = `【SampleRequest】依頼受付完了のお知らせ (注文ID: ${order.id.substring(0, 8)}...)`;
    const body = `
${order.requester} 様

お疲れ様です。
以下のサンプル依頼を受け付けました。
担当者が確認後、手配を進めます。

■納品先:
${order.targetName} 様
〒${order.zip || ''} ${order.address}

■納品指定日: ${AppUtils_formatDate(order.targetDate)} ${order.timeSlot || ''}
■商品:
${order.items.map(i => `・${i.name} x${i.qty}`).join('\n')}

■備考:
${order.remarks || 'なし'}

(本メールは自動送信です)
確認画面: https://nano545.github.io/sample-shipping
    `.trim();

    try {
        MailApp.sendEmail(requesterEmail, subject, body);
    } catch (e) {
        console.error('[Req Confirmation] Failed:', e);
    }
}


/**
 * 未処理放置の警告メール送信 (トリガー実行用)
 * 土日を除いて2日以上経過した未処理オーダーを通知
 */
function checkPendingOrders() {
    if (!ENABLE_EMAIL_NOTIFICATION || !NOTIFICATION_EMAIL) return;

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) return;

    const data = sheet.getDataRange().getValues();
    const pendingOrders = [];
    const now = new Date();

    // Calculate Threshold: 2 Business Days Ago
    const thresholdDate = getBusinessDaysAgo(2, now);

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row[0]) continue;

        const id = row[0];
        const timestamp = new Date(row[1]);
        const requester = row[2];
        const targetName = row[5];
        const status = row[10];

        // Status '未処理' and older than threshold
        if (status === '未処理' && timestamp < thresholdDate) {
            pendingOrders.push({
                id: id,
                timestamp: timestamp,
                requester: requester,
                targetName: targetName
            });
        }
    }

    if (pendingOrders.length === 0) return;

    // Send Alert Email
    const subject = `【警告】未処理の注文が滞留しています (${pendingOrders.length}件)`;
    const body = `
未処理のまま2営業日以上経過している注文があります。
早急に確認・手配を行ってください。

■滞留注文一覧:
${pendingOrders.map(o => `・${AppUtils_formatDate(o.timestamp)}受注: ${o.requester}様 -> ${o.targetName}様 (ID: ${o.id})`).join('\n')}

管理画面:
https://nano545.github.io/sample-shipping/admin.html
    `.trim();

    try {
        MailApp.sendEmail(NOTIFICATION_EMAIL, subject, body);
    } catch (e) {
        console.error('Alert Email Failed:', e);
    }
}

/**
 * 指定された日数前の「営業日（土日除く）」の日時を返す
 * @param {number} n - 遡る営業日数
 * @param {Date} fromDate - 起点となる日時
 * @returns {Date} - n営業日前の日時
 */
function getBusinessDaysAgo(n, fromDate) {
    let date = new Date(fromDate.getTime());
    let count = 0;
    while (count < n) {
        date.setDate(date.getDate() - 1);
        const day = date.getDay();
        // 0=Sun, 6=Sat
        if (day !== 0 && day !== 6) {
            count++;
        }
    }
    return date;
}

