/**
 * No Limits — Lead → Script  ·  logging Web App
 * -----------------------------------------------------------------------------
 * Append-only logger for the Lead → Script app. Deploy as a Web App
 * ("Execute as: Me", "Who has access: Anyone") and put the /exec URL in the
 * app's LOG_WEBAPP_URL env var. Set a Script Property LOG_SHARED_SECRET that
 * matches the app's env var of the same name.
 *
 * Writes to a single append-only tab called "ScriptLog". Two event types share
 * the tab, one row each. Uses LockService so concurrent writes never collide.
 *
 * PRIVACY: this endpoint only ever receives whitelisted fields from the server.
 * Never log full lead text, phone numbers, emails, street addresses, or
 * transcripts — the app is built not to send them, and neither should you add
 * them here.
 */

var TAB = 'ScriptLog';
var HEADERS = [
  'timestamp',
  'event',
  'rep',
  // script_generated
  'customer_first_name',
  'route_from',
  'route_to',
  'distance_category',
  'levers',
  'flexible_window',
  'quoted_price',
  // practice_scored
  'difficulty',
  'overall',
  'stage_open',
  'stage_discovery',
  'stage_presentation',
  'stage_objections',
  'stage_close',
  'laerc_listen',
  'laerc_acknowledge',
  'laerc_explore',
  'laerc_respond',
  'laerc_confirm',
  'turns'
];

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);

    var body = {};
    try {
      body = JSON.parse(e.postData.contents);
    } catch (err) {
      return json_({ ok: false, error: 'bad json' });
    }

    var secret = PropertiesService.getScriptProperties().getProperty('LOG_SHARED_SECRET');
    if (!secret || body.secret !== secret) {
      return json_({ ok: false, error: 'unauthorized' });
    }

    var sheet = getSheet_();
    var now = new Date();
    var row;

    if (body.type === 'script_generated') {
      row = [
        now, 'script_generated', body.rep || '',
        body.customerFirstName || '',
        body.routeFrom || '',
        body.routeTo || '',
        body.distanceCategory || '',
        body.levers || '',
        body.flexibleWindow === true,
        (body.quotedPrice === null || body.quotedPrice === undefined) ? '' : body.quotedPrice,
        '', '', '', '', '', '', '', '', '', '', '', '', ''
      ];
    } else if (body.type === 'practice_scored') {
      var s = body.stageScores || [];
      var la = body.laerc || [];
      row = [
        now, 'practice_scored', body.rep || '',
        '', '', '', '', '', '', '',
        body.difficulty || '',
        (body.overall === null || body.overall === undefined) ? '' : body.overall,
        num_(s[0]), num_(s[1]), num_(s[2]), num_(s[3]), num_(s[4]),
        la[0] === true, la[1] === true, la[2] === true, la[3] === true, la[4] === true,
        (body.turns === null || body.turns === undefined) ? '' : body.turns
      ];
    } else {
      return json_({ ok: false, error: 'unknown event' });
    }

    sheet.appendRow(row);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TAB);
  if (!sheet) {
    sheet = ss.insertSheet(TAB);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function num_(v) {
  return (v === null || v === undefined || isNaN(v)) ? '' : v;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
