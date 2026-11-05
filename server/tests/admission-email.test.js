import assert from 'node:assert/strict';
import {
  buildAdmissionEmailTemplate,
  sendAdmissionNotificationEmail,
} from '../src/services/admission-email.service.js';
import {
  getTestEmails,
  clearTestEmails,
  enableTestMode,
} from '../src/services/email.service.js';

console.log('=== RUNNING ADMISSION EMAIL TEMPLATE TESTS ===\n');

enableTestMode(true);
clearTestEmails();

// ---------------------------------------------------------------------------
// TEST 1: Application Received (SUBMITTED) Event
// ---------------------------------------------------------------------------
console.log('[TEST 1] Application Received (SUBMITTED) Template Generation');
{
  const template = buildAdmissionEmailTemplate({
    subType: 'SUBMITTED',
    madrasaName: 'AL/MAHMOODHIYYA ARABIC COLLAGE',
    logoUrl: 'https://pub-1f3635c914c44233924767034014c12a.r2.dev/madrasas/cmu17e3z10002v4c4dck2f556/logos/logo_1793279586092_s6pdutt.webp',
    recipientName: 'Naseerdeen',
    applicantName: 'Mohamed Safras',
    applicationNo: 'APP-2026-88694',
    intakeName: 'First Term Regular Intake',
    academicYear: 2026,
    className: 'Class 1A - Hifz',
    status: 'PENDING',
    submittedAt: '2026-10-29T17:04:19.124Z',
    contactPhone: '+94783254552',
    contactEmail: 'admissions@almahmoodhiyya.edu',
  });

  assert(template.subject.includes('Admission Application Received'), 'Subject contains Application Received');
  assert(template.subject.includes('APP-2026-88694'), 'Subject contains application reference');
  assert(template.subject.includes('AL/MAHMOODHIYYA ARABIC COLLAGE'), 'Subject contains institution name');

  // HTML checks
  assert(template.html.includes('AL/MAHMOODHIYYA ARABIC COLLAGE'), 'HTML contains institution name');
  assert(template.html.includes('https://pub-1f3635c914c44233924767034014c12a.r2.dev/madrasas/'), 'HTML contains logo URL');
  assert(template.html.includes('Mohamed Safras'), 'HTML contains applicant name');
  assert(template.html.includes('Naseerdeen'), 'HTML contains guardian name');
  assert(template.html.includes('APP-2026-88694'), 'HTML contains reference number');
  assert(template.html.includes('Class 1A - Hifz'), 'HTML contains class name');
  assert(template.html.includes('Under Review'), 'HTML contains Under Review badge');
  assert(template.html.includes('strictly via email'), 'HTML contains email-only policy notice');
  assert(template.html.includes('+94783254552'), 'HTML contains contact phone');
  assert(!template.html.includes('undefined'), 'HTML contains no undefined strings');

  // Plain text checks
  assert(template.text.includes('AL/MAHMOODHIYYA ARABIC COLLAGE'), 'Text contains institution name');
  assert(template.text.includes('APP-2026-88694'), 'Text contains reference number');
  assert(template.text.includes('Mohamed Safras'), 'Text contains applicant name');
  assert(template.text.includes('strictly via email'), 'Text contains email communication notice');

  console.log('  ✓ [PASS] Application Received template generated with full branding, details, and text fallback');
}

// ---------------------------------------------------------------------------
// TEST 2: Admission Approved (APPROVED) Event
// ---------------------------------------------------------------------------
console.log('\n[TEST 2] Admission Approved (APPROVED) Template Generation');
{
  const template = buildAdmissionEmailTemplate({
    subType: 'APPROVED',
    madrasaName: 'AL/MAHMOODHIYYA ARABIC COLLAGE',
    logoUrl: 'https://pub-1f3635c914c44233924767034014c12a.r2.dev/madrasas/cmu17e3z10002v4c4dck2f556/logos/logo_1793279586092_s6pdutt.webp',
    recipientName: 'Naseerdeen',
    applicantName: 'Mohamed Safras',
    applicationNo: 'APP-2026-88694',
    intakeName: 'First Term Regular Intake',
    academicYear: 2026,
    className: 'Class 1A - Hifz',
    status: 'APPROVED',
    remarks: 'Candidate passed baseline Quranic oral assessment with distinction.',
    contactPhone: '+94783254552',
    contactEmail: 'admissions@almahmoodhiyya.edu',
  });

  assert(template.subject.includes('Admission Approved:'), 'Subject contains Admission Approved');
  assert(template.html.includes('Congratulations!'), 'HTML contains congratulations heading');
  assert(template.html.includes('approved'), 'HTML specifies approved status');
  assert(template.html.includes('Candidate passed baseline Quranic oral assessment with distinction.'), 'HTML includes reviewer remarks');
  assert(!template.html.includes('Officially Enrolled'), 'Does not falsely claim enrollment before conversion');

  console.log('  ✓ [PASS] Admission Approved template confirms approval without falsely claiming enrollment');
}

// ---------------------------------------------------------------------------
// TEST 3: Enrollment Confirmed / Converted (CONVERTED) Event
// ---------------------------------------------------------------------------
console.log('\n[TEST 3] Enrollment Confirmed (CONVERTED) Template Generation');
{
  const template = buildAdmissionEmailTemplate({
    subType: 'CONVERTED',
    madrasaName: 'AL/MAHMOODHIYYA ARABIC COLLAGE',
    logoUrl: 'https://pub-1f3635c914c44233924767034014c12a.r2.dev/madrasas/cmu17e3z10002v4c4dck2f556/logos/logo_1793279586092_s6pdutt.webp',
    recipientName: 'Naseerdeen',
    applicantName: 'Mohamed Safras',
    applicationNo: 'APP-2026-88694',
    admissionNo: 'ADM-2026-0042',
    intakeName: 'First Term Regular Intake',
    academicYear: 2026,
    className: 'Class 1A - Hifz',
    status: 'CONVERTED',
    contactPhone: '+94783254552',
    contactEmail: 'admissions@almahmoodhiyya.edu',
  });

  assert(template.subject.includes('Enrollment Confirmed:'), 'Subject specifies Enrollment Confirmed');
  assert(template.html.includes('ADM-2026-0042'), 'HTML contains official admission number');
  assert(template.html.includes('Officially Enrolled'), 'HTML contains Officially Enrolled badge');
  assert(template.html.includes('enrolled as a student at'), 'HTML confirms formal student enrollment');
  assert(template.text.includes('ADM-2026-0042'), 'Text contains official admission number');

  console.log('  ✓ [PASS] Enrollment Confirmed template delivers official admission number and enrollment confirmation');
}

// ---------------------------------------------------------------------------
// TEST 4: Admission Status Update / Rejected (REJECTED) Event
// ---------------------------------------------------------------------------
console.log('\n[TEST 4] Admission Status Update (REJECTED) Template Generation');
{
  const template = buildAdmissionEmailTemplate({
    subType: 'REJECTED',
    madrasaName: 'AL/MAHMOODHIYYA ARABIC COLLAGE',
    recipientName: 'Parent Guardian',
    applicantName: 'Tariq Mansoor',
    applicationNo: 'APP-2026-11223',
    status: 'REJECTED',
    decisionText: 'Class capacity reached for selected level.',
    remarks: 'We invite you to apply for our upcoming evening cycle.',
    contactPhone: '+94783254552',
    contactEmail: 'admissions@almahmoodhiyya.edu',
  });

  assert(template.subject.includes('Application Status Update:'), 'Subject specifies Application Status Update');
  assert(template.html.includes('Application Not Accepted'), 'HTML contains status badge');
  assert(template.html.includes('Class capacity reached for selected level.'), 'HTML reflects decision text');
  assert(template.html.includes('We invite you to apply for our upcoming evening cycle.'), 'HTML reflects reviewer remarks');
  assert(!template.html.includes('Congratulations'), 'Does not contain congratulations on rejection');

  console.log('  ✓ [PASS] Rejection / Status Update template displays decision text respectfully and accurately');
}

// ---------------------------------------------------------------------------
// TEST 5: Graceful Handling of Missing Optional Fields
// ---------------------------------------------------------------------------
console.log('\n[TEST 5] Graceful Handling of Missing Optional Fields');
{
  const template = buildAdmissionEmailTemplate({
    subType: 'SUBMITTED',
    madrasaName: 'AL/MAHMOODHIYYA ARABIC COLLAGE',
    logoUrl: null, // No logo URL
    recipientName: '',
    applicantName: 'Anonymous Applicant',
    applicationNo: 'APP-2026-99999',
    // Missing className, intakeName, academicYear, remarks, admissionNo, contactPhone, contactEmail
  });

  assert(!template.html.includes('undefined'), 'HTML contains no undefined');
  assert(!template.html.includes('null'), 'HTML contains no null strings');
  assert(!template.text.includes('undefined'), 'Text contains no undefined');
  assert(!template.text.includes('null'), 'Text contains no null strings');
  // Initials monogram rendered when logoUrl is null
  assert(template.html.includes('AM'), 'HTML renders fallback monogram initials');

  console.log('  ✓ [PASS] Template handles missing optional fields cleanly without broken tags or labels');
}

// ---------------------------------------------------------------------------
// TEST 6: XSS Sanitization & HTML Escaping
// ---------------------------------------------------------------------------
console.log('\n[TEST 6] XSS Sanitization & HTML Escaping');
{
  const maliciousName = '<script>alert("XSS")</script>Mohammed & Sons';
  const maliciousRemarks = '"><img src=x onerror=alert(1)>Special notes';
  const template = buildAdmissionEmailTemplate({
    subType: 'SUBMITTED',
    madrasaName: 'AL/MAHMOODHIYYA & CO',
    applicantName: maliciousName,
    remarks: maliciousRemarks,
    applicationNo: 'APP-2026-XSS01',
  });

  assert(!template.html.includes('<script>'), 'Script tags escaped in HTML');
  assert(template.html.includes('&lt;script&gt;'), 'Script tags converted to HTML entities');
  assert(!template.html.includes('onerror=alert(1)>'), 'Onerror attribute injection blocked');

  console.log('  ✓ [PASS] User input safely escaped to prevent HTML/XSS injection in email clients');
}

// ---------------------------------------------------------------------------
// TEST 7: Dispatch Email Integration via Test Mode
// ---------------------------------------------------------------------------
console.log('\n[TEST 7] Dispatch Email Integration via Test Mode');
{
  clearTestEmails();

  const template = buildAdmissionEmailTemplate({
    subType: 'SUBMITTED',
    madrasaName: 'AL/MAHMOODHIYYA ARABIC COLLAGE',
    logoUrl: 'https://pub-1f3635c914c44233924767034014c12a.r2.dev/madrasas/cmu17e3z10002v4c4dck2f556/logos/logo_1793279586092_s6pdutt.webp',
    recipientName: 'Naseerdeen',
    applicantName: 'Mohamed Safras',
    applicationNo: 'APP-2026-88694',
    status: 'PENDING',
  });

  const sendResult = await sendAdmissionNotificationEmail({
    madrasaId: 'cmu17e3z10002v4c4dck2f556',
    to: 'mhdshafraz295@gmail.com',
    subject: template.subject,
    html: template.html,
    text: template.text,
  });

  assert(sendResult.success === true, 'Send result is success');
  assert(sendResult.status === 'SENT', 'Send status is SENT');

  const queued = getTestEmails();
  assert(queued.length === 1, 'Exactly 1 test email queued');
  assert(queued[0].to === 'mhdshafraz295@gmail.com', 'Recipient matches');
  assert(queued[0].html.includes('AL/MAHMOODHIYYA ARABIC COLLAGE'), 'Dispatched HTML includes institution name');
  assert(queued[0].text.includes('APP-2026-88694'), 'Dispatched text includes reference number');

  console.log('  ✓ [PASS] Dispatched email successfully captured in test mailbox with full HTML and plain text');
}

console.log('\n=============================================');
console.log('All Admission Email Template Tests Passed!');
console.log('=============================================\n');
