# MadrasaNexa – Phase 2 Batch 2D: Final Responsive Audit & Implementation Plan

**Date:** 2026-11-12  
**Mode:** READ-ONLY AUDIT & PLANNING ONLY  
**Viewports Evaluated:** `320px`, `375px`, `430px`, `768px`, `1024px`, `1280px`  
**Verification Method:** Static code inspection (`madrasanexa/src/**`); live browser rendering is **NOT VERIFIED**.

---

## A. Executive Summary

- **Overall Responsive Quality:** Good across the core dashboards, layouts, and modules already upgraded in Phase 1 and Phase 2 Batches 2A, 2B, 2C-1, 2C-2, and 2C-3. No Critical defects were found in the remaining audited modules, and `45` of the `83` newly audited files are already clean across `320px`–`1280px`.
- **Areas Successfully Covered by Previous Batches:**
  - **Phase 1 & Batch 2A:** `MadrasaAdminLayout`, `DashboardPage`, `ReportsPage`, `InvoiceDetailPage`, `PaymentDetailPage`, `ReceiptDetailPage`, `StudentDetailPage`, `MarkEntryGrid`, `StudentsPage`, `NotificationLogsPage`, `InvoiceGenerationPage`.
  - **Batch 2B (Super Admin):** `SuperAdminLayout`, `DashboardPage`, `OnboardingRequestsPage`, `MadrasaDetailPage`, `AnnouncementsPage`, `WebsiteContentPage`, `AboutUsCMSPage`, `SubscriptionPaymentsPage`, `PlansPage`, `BankDetailsPage`, `ActivityLogsPage`, `ManagePlanFeaturesModal`, `PlanFeatureSelector`, `PlanComparisonMatrix`.
  - **Batch 2C-1 (Alumni & Admissions):** `AlumniManagementPage`, `AdmissionsManagementPage`, `InterviewManagementSection`.
  - **Batch 2C-2 (Classes, Timetable & Marking):** `ClassesPage`, `TimetablePage`, `ClassTimetableView`, `FullTimetableView`, `StaffTimetableView`, `TimetableBreakModal`, `TimetableFinalizeModal`, `ClassAnalyticsView`, `NewAssessmentModal`, `GpaSettingsPanel`, `ResultsTable`, `SubjectManagerModal`.
  - **Batch 2C-3 (Attendance & Ustadh/Staff):** `AttendancePage`, `AttendanceFilters`, `AttendanceSummaryCards`, `AttendanceHistoryTab`, `AttendanceStudentList`, `MonthlySummaryTab`, `StudentAttendanceTab`, `UstadhManagementPage`, `UstadhScheduleTab`, `StaffAttendanceTab`, `SalaryAdjustmentModal`, `SalaryEmailModal`, `SalaryPaymentModal`, `ScheduleModal`, `UstadhEmailModal`, `UstadhModal`, `UstadhDirectoryTab`, `MonthlySalaryTab`, `SalaryPaymentHistoryTab`.
- **Remaining Confirmed Issues:** **38 files** contain genuine responsive defects (**10 High**, **21 Medium**, **7 Low** at the file/component level — zero Critical). Primary themes are:
  1. Mobile navbar / lightbox / receipt modal viewport clipping (`PublicNavbar`, `MadrasaPublicNavbar`, `ImageLightbox`, `MadrasaAdmissionsPage`).
  2. Non-wrapping flex headers, action rows, and language/filter bars at `320px`–`430px` (`AboutUsPage`, `ExpenseAnalysisPage`, `FeePOSPage`, `EmailSenderSettingsTab`, `CurriculumManagerTab`, `MadrasaHomepageCmsPage`).
  3. Modals missing `max-h-[90vh] overflow-y-auto` (`ExpenseCategoryManager`, `ExpenseHistoryTable`, `MonthlyInsightModal`, `FeePOSPage`, `InvoicesPage`, `PaymentsPage`, `StudentRecordsPanels`, `CurriculumManagerTab`).
  4. Unconstrained grids (`grid-cols-3`, `grid-cols-2`, `lg:grid-cols-5`), long email/slug/filename overflow (`break-all`, `min-w-0`), and table `<th>` headers missing `whitespace-nowrap`.

---

## B. Git Safety Report

- **Branch:** `main`
- **HEAD:** `8fb87870f6e986a0cfc415c3c7e83439fff31e50`
- **Staged Files (13 preserved):**
  - `madrasanexa/src/components/announcement/AnnouncementBell.tsx`
  - `madrasanexa/src/components/dashboard/InstitutionalLiveClock.tsx`
  - `madrasanexa/src/components/super-admin/PlanComparisonMatrix.tsx`
  - `madrasanexa/src/layouts/MadrasaAdminLayout.tsx`
  - `madrasanexa/src/pages/madrasa-admin/DashboardPage.tsx`
  - `madrasanexa/src/pages/madrasa-admin/NotificationLogsPage.tsx`
  - `madrasanexa/src/pages/madrasa-admin/ReceiptDetailPage.tsx`
  - `madrasanexa/src/pages/madrasa-admin/StudentsPage.tsx`
  - `madrasanexa/src/pages/super-admin/PlansPage.tsx`
  - `server/src/services/admission-email.service.js`
  - `server/src/services/email.service.js`
  - `server/src/services/interview-email.service.js`
  - `server/src/services/notification.service.js`
- **Unstaged Modified Files:** `63` files preserved from Phase 1, Batches 2A/2B/2C-1/2C-2/2C-3, and pre-existing work.
- **Untracked Files:** Pre-existing `PHASE3_*` through `PHASE8_*` markdown reports, `madrasanexa/public/favicon.png`, `server/` verification PNGs and migrations, plus this newly generated read-only audit report `PHASE_2D_FINAL_RESPONSIVE_AUDIT_REPORT.md`.
- **Audit Integrity Confirmation:** Zero source files or configuration files were modified, staged, committed, pushed, or deployed during this audit.

---

## C. Audit Coverage

- **Newly Audited Files (83 files):**
  - **Public Website, Madrasa Public Portal & Auth (39 files):** `pages/public/` (`HomePage`, `AboutUsPage`, `PricingPage`, `MadrasaPublicPage`, `MadrasaAdmissionsPage`), `components/public/` (all 17 files), `components/madrasa-public/` (all 12 files), `components/about-us/AboutUsContentView`, `pages/auth/` (`LoginPage`, `RegisterPage`, `ChangePasswordPage`, `SetupPasswordPage`).
  - **Expense Analysis, Fee POS, Invoices, Payments, Students & Subscription (23 files):** `ExpenseAnalysisPage`, `components/expense-analysis/` (all 10 files), `FeePOSPage`, `InvoicesPage`, `PaymentsPage`, `StudentAddPage`, `StudentEditPage`, `components/students/StudentRecordsPanels`, `SubscriptionPage`, `SubscriptionRequiredPage`, `components/subscription/` (all 4 files).
  - **Settings, Portal CMS, Shared & Remaining Super Admin (21 files):** `SettingsPage`, `components/settings/` (all 3 files), `MadrasaHomepageCmsPage`, `components/portal-cms/` (all 4 files), `madrasa-admin/AnnouncementsPage`, `ActivityPage`, `madrasa-admin/AboutUsPage`, `MadrasaAdminWorkspace`, `MarkingHubPage`, `MarkingFilters`, `AnnouncementBell`, `InstitutionalLiveClock`, `super-admin/MadrasasPage`, `super-admin/SubscriptionsPage`, `SuperAdminWorkspace`, `HomepageImageUploader`.
- **Viewport Widths Inspected:** `320px`, `375px`, `430px`, `768px`, `1024px`, `1280px`.
- **Static vs. Browser Verification:** All findings below are derived from **static code inspection**. Live browser visual verification across `320px`–`1280px` is **NOT VERIFIED**.

---

## D. Findings

### D1. Public Website, Madrasa Public Portal & Auth

#### 1. `madrasanexa/src/components/public/PublicNavbar.tsx`
- **Component:** `PublicNavbar`
- **Line(s):** 69, 85, 92–123, 170–184
- **Severity:** High
- **Affected Viewports:** `1024px`
- **Existing Behavior:** At `1024px` (`max-w-7xl px-8` = `960px` inner width), the brand block (~237px with `"Islamic Institutional Platform"`), 7 nav items with `px-3.5`, and two CTA buttons (`Portal Login`, `Get Started` without `whitespace-nowrap`) require ~1121px, causing CTA text wrapping inside the fixed `h-20` header or horizontal overflow.
- **Expected Behavior:** All navbar items, brand, and CTAs fit cleanly on one row at `1024px`.
- **Recommended Minimum Fix:** Use `lg:px-2 xl:px-3.5` on nav links/Quick Links button, `hidden xl:block` on `"Islamic Institutional Platform"` (line 85), and `whitespace-nowrap shrink-0` on `Portal Login` and `Get Started`.

#### 2. `madrasanexa/src/components/madrasa-public/MadrasaPublicNavbar.tsx`
- **Component:** `MadrasaPublicNavbar`
- **Line(s):** 302–369 (High); 167–175, 180–209 (Medium)
- **Severity:** High
- **Affected Viewports:** `320px`, `375px`, `430px`, `768px`, `1024px`
- **Existing Behavior:**
  - Lines 302–369: Mobile dropdown (`absolute top-full inset-x-0`) lacks `max-h` and `overflow-y-auto`. When all optional links + quick links + `"Apply for Admissions"` are active, the menu (~650–750px) clips off-screen on shorter mobile viewports.
  - Lines 167–209: At `1024px`, with all optional links active, `"Official Institutional Portal"` has `whitespace-nowrap` and collides with the nav row.
- **Expected Behavior:** Mobile menu scrolls within viewport height; `1024px` desktop header fits without collision.
- **Recommended Minimum Fix:** Add `max-h-[calc(100dvh-5rem)] overflow-y-auto` on line 303; use `lg:px-2 xl:px-3` on desktop nav links and `truncate` (instead of `whitespace-nowrap`) on line 169.

#### 3. `madrasanexa/src/components/public/ImageLightbox.tsx`
- **Component:** `ImageLightbox`
- **Line(s):** 112–150
- **Severity:** High
- **Affected Viewports:** `320px`, `375px`, `430px`
- **Existing Behavior:** Close button uses `absolute -top-12 right-0 md:top-2 md:right-2`, pushing it above the top edge of the viewport when the modal approaches `max-h-[90vh]`. Inner wrapper uses `overflow-hidden` with `max-h-[80vh]` image + caption, risking caption clipping.
- **Expected Behavior:** Close button stays visible inside the viewport and tall content scrolls cleanly.
- **Recommended Minimum Fix:** Place the close button inside the container (`top-2 right-2` or a flex header bar), and use `max-h-[70vh] sm:max-h-[78vh]` on the image with `overflow-y-auto` on the dialog wrapper.

#### 4. `madrasanexa/src/pages/public/AboutUsPage.tsx`
- **Component:** `AboutUsPage`
- **Line(s):** 70–115 (High); 119, 126, 138 (Low)
- **Severity:** High
- **Affected Viewports:** `320px`, `375px`, `430px`
- **Existing Behavior:** Language selector bar (`flex items-center justify-between gap-4`, line 70) lacks `flex-wrap`, overflowing at `320px` (~331px content in 288px inner width). Error/empty cards (`max-w-lg mx-auto`) touch screen edges on mobile.
- **Expected Behavior:** Language bar wraps cleanly on mobile; state cards have horizontal margin.
- **Recommended Minimum Fix:** Change line 70 to `flex flex-wrap items-center justify-between gap-3 sm:gap-4`; add `mx-4 sm:mx-auto` on lines 126 and 138.

#### 5. `madrasanexa/src/pages/public/MadrasaAdmissionsPage.tsx`
- **Component:** `MadrasaAdmissionsPage`
- **Line(s):** 618–657 (High); 411–419, 432–437, 540–548, 702–750, 762, 790, 995, 1034 (Medium)
- **Severity:** High
- **Affected Viewports:** `320px`, `375px`, `430px`
- **Existing Behavior:** Confirmation receipt header (`flex items-start justify-between gap-4`, line 618) squishes/overflows inside ~200px inner width on `320px`. Intake badge/window rows (lines 411, 432), receipt action buttons (line 790), supporting docs header (line 995), long emails (lines 541, 762), dossier values (lines 702–750), and uploaded filename row (`max-w-xs`, line 1034) lack wrapping/`min-w-0`/`break-all`.
- **Expected Behavior:** Receipt header stacks on mobile; emails, filenames, and metadata rows wrap or truncate without overflow.
- **Recommended Minimum Fix:** Change line 618 to `flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4`; add `flex-wrap gap-2` on lines 411, 432, 790, 995; add `break-all` on emails, `min-w-0 break-words` on dossier values, and `min-w-0 flex-1` on line 1034.

#### 6. `madrasanexa/src/pages/auth/SetupPasswordPage.tsx`
- **Component:** `SetupPasswordPage`
- **Line(s):** 157–170
- **Severity:** Medium
- **Affected Viewports:** `320px`, `375px`
- **Existing Behavior:** `tokenData.email` and `tokenData.madrasaName` inside `flex justify-between py-0.5` lack `gap-2`, `min-w-0`, and `break-all`/`break-words`, overflowing on long values.
- **Expected Behavior:** Long emails and madrasa names wrap cleanly within the card.
- **Recommended Minimum Fix:** Add `gap-2` on both rows, `shrink-0` on labels, `min-w-0 text-right break-all` on `tokenData.email`, and `min-w-0 text-right break-words` on `tokenData.madrasaName`.

#### 7. `madrasanexa/src/components/about-us/AboutUsContentView.tsx`
- **Component:** `AboutUsContentView`
- **Line(s):** 481–503
- **Severity:** Medium
- **Affected Viewports:** `320px`, `375px`
- **Existing Behavior:** Highlights/metrics grid uses `grid-cols-2 md:grid-cols-4 gap-6` with `p-6`, leaving only ~84px inner width per card at `320px`.
- **Expected Behavior:** Metrics cards have adequate width on narrow mobile viewports.
- **Recommended Minimum Fix:** Change line 481 to `grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 lg:gap-8` and line 487 padding to `p-4 sm:p-6`.

#### 8. `madrasanexa/src/components/public/AboutSection.tsx` & `madrasanexa/src/components/madrasa-public/MadrasaPublicAbout.tsx`
- **Components:** `AboutSection`, `MadrasaPublicAbout`
- **Line(s):** `AboutSection.tsx:113–125`, `MadrasaPublicAbout.tsx:90–103`
- **Severity:** Low
- **Affected Viewports:** `320px`
- **Existing Behavior:** Card footer `flex items-center justify-between` lacks `flex-wrap gap-2`, causing awkward wrapping/collision at `320px`.
- **Expected Behavior:** Footer link and label wrap cleanly when needed.
- **Recommended Minimum Fix:** Add `flex-wrap gap-2` to the footer row container in both files.

#### 9. `madrasanexa/src/components/madrasa-public/MadrasaPublicCurriculum.tsx`
- **Component:** `MadrasaPublicCurriculum`
- **Line(s):** 313–323, 382–391
- **Severity:** Low
- **Affected Viewports:** `320px`, `375px`
- **Existing Behavior:** Level subjects header and book title + completionNotes row use `flex items-center justify-between` without `flex-wrap gap-2` or `min-w-0`.
- **Expected Behavior:** Long level labels and book titles wrap cleanly without collision.
- **Recommended Minimum Fix:** Add `flex-wrap gap-2` to lines 313 and 382, and `min-w-0 break-words` on `bk.title`.

---

### D2. Expense Analysis, Fee POS, Invoices, Payments, Students & Subscription

#### 10. `madrasanexa/src/pages/madrasa-admin/ExpenseAnalysisPage.tsx`
- **Component:** `ExpenseAnalysisPage`
- **Line(s):** 277
- **Severity:** Medium
- **Affected Viewports:** `320px`, `375px`
- **Existing Behavior:** Export buttons (`PDF`, `Summary CSV`, `Details CSV`) sit in `<div className="flex items-center gap-1.5">` without `flex-wrap`, overflowing at `320px`.
- **Expected Behavior:** Export buttons wrap cleanly onto a second row on narrow screens.
- **Recommended Minimum Fix:** Change line 277 to `<div className="flex flex-wrap items-center gap-1.5">`.

#### 11. `madrasanexa/src/components/expense-analysis/ExpenseBudgetModal.tsx`
- **Component:** `ExpenseBudgetModal`
- **Line(s):** 118–125, 140–167
- **Severity:** High
- **Affected Viewports:** `320px`, `375px`
- **Existing Behavior:** Footer (`flex items-center justify-between`, line 140) places Total Monthly Budget + `Cancel` + `Save All Budgets` in one non-wrapping row (~313px), overflowing the modal on mobile. Input wrapper `w-36` (line 125) leaves only ~60px for category names at `320px`.
- **Expected Behavior:** Footer stacks/wraps cleanly and category names remain readable.
- **Recommended Minimum Fix:** Change line 140 to `flex flex-col sm:flex-row sm:items-center justify-between gap-3`, add `w-full sm:w-auto justify-end` to line 150, and change line 125 to `w-28 sm:w-36 shrink-0 flex items-center gap-1.5`.

#### 12. `madrasanexa/src/components/expense-analysis/ExpenseCategoryManager.tsx`
- **Component:** `ExpenseCategoryManager`
- **Line(s):** 78–92, 98–101, 163
- **Severity:** Medium
- **Affected Viewports:** `320px`, `375px`
- **Existing Behavior:** Header `flex items-center justify-between` (line 78) squeezes subtitle against `New Category`; `<th>` headers (lines 98–101) lack `whitespace-nowrap`; modal container (line 163) lacks `max-h-[90vh] overflow-y-auto`.
- **Expected Behavior:** Header stacks on mobile, `<th>` stay single-line, and modal scrolls within `90vh`.
- **Recommended Minimum Fix:** Use `flex-col sm:flex-row sm:items-center justify-between gap-3` on line 78 (`shrink-0 self-start sm:self-auto` on button), add `whitespace-nowrap` to `<th>`, and add `max-h-[90vh] overflow-y-auto` on line 163.

#### 13. `madrasanexa/src/components/expense-analysis/ExpenseEntryModal.tsx`
- **Component:** `ExpenseEntryModal`
- **Line(s):** 215
- **Severity:** Medium
- **Affected Viewports:** `320px`, `375px`
- **Existing Behavior:** `<div className="grid grid-cols-3 gap-3">` forces `Quantity`, `Unit`, and `Unit Cost` into ~61px columns at `320px`.
- **Expected Behavior:** Stack metadata inputs on mobile and use 3 columns on `sm+`.
- **Recommended Minimum Fix:** Change line 215 to `grid grid-cols-1 sm:grid-cols-3 gap-3`.

#### 14. `madrasanexa/src/components/expense-analysis/ExpenseHistoryTable.tsx`
- **Component:** `ExpenseHistoryTable`
- **Line(s):** 134–141, 242, 268
- **Severity:** Medium
- **Affected Viewports:** `320px`, `375px`
- **Existing Behavior:** `<th>` headers lack `whitespace-nowrap`; pagination bar (line 242) lacks `flex-col sm:flex-row gap-3`; Void modal (line 268) lacks `max-h-[90vh] overflow-y-auto`.
- **Expected Behavior:** Headers stay single-line, pagination stacks on mobile, and modal is `90vh`-bounded.
- **Recommended Minimum Fix:** Add `whitespace-nowrap` to `<th>`, `flex-col sm:flex-row gap-3` on line 242, and `max-h-[90vh] overflow-y-auto` on line 268.

#### 15. `madrasanexa/src/components/expense-analysis/ExpenseSummaryCards.tsx`
- **Component:** `ExpenseSummaryCards`
- **Line(s):** 69
- **Severity:** Medium
- **Affected Viewports:** `1024px`
- **Existing Behavior:** `lg:grid-cols-5` squeezes 5 KPI cards into ~140–175px each at `1024px`, causing `text-xl` currency figures to wrap/clip.
- **Expected Behavior:** Use 3 columns at `lg` and 5 columns at `xl`.
- **Recommended Minimum Fix:** Change line 69 to `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4`.

#### 16. `madrasanexa/src/components/expense-analysis/MonthlyComparisonTable.tsx`
- **Component:** `MonthlyComparisonTable`
- **Line(s):** 36–44, 181
- **Severity:** Low
- **Affected Viewports:** `768px`, `1024px`
- **Existing Behavior:** Desktop `<th>` headers lack `whitespace-nowrap`; mobile card header (line 181) lacks `gap-2` and `min-w-0`.
- **Expected Behavior:** Headers stay single-line inside `overflow-x-auto`.
- **Recommended Minimum Fix:** Add `whitespace-nowrap` to `<th>` elements and `gap-2` on line 181.

#### 17. `madrasanexa/src/components/expense-analysis/MonthlyInsightModal.tsx`
- **Component:** `MonthlyInsightModal`
- **Line(s):** 68
- **Severity:** Medium
- **Affected Viewports:** `320px`, `375px`, `430px`
- **Existing Behavior:** Modal container lacks `max-h-[90vh] overflow-y-auto`.
- **Expected Behavior:** Modal scrolls within `90vh` on short viewports.
- **Recommended Minimum Fix:** Add `max-h-[90vh] overflow-y-auto` to line 68.

#### 18. `madrasanexa/src/components/expense-analysis/CostReviewPanel.tsx`
- **Component:** `CostReviewPanel`
- **Line(s):** 30, 58, 84
- **Severity:** Low
- **Affected Viewports:** `320px`
- **Existing Behavior:** `flex items-center justify-between` rows lack `flex-wrap gap-2`, `min-w-0`, and `shrink-0`.
- **Expected Behavior:** Long category names wrap or truncate cleanly alongside amounts.
- **Recommended Minimum Fix:** Add `flex-wrap gap-2` to lines 30, 58, and 84, with `min-w-0` on text containers and `shrink-0` on amounts/badges.

#### 19. `madrasanexa/src/pages/madrasa-admin/FeePOSPage.tsx`
- **Component:** `FeePOSPage`
- **Line(s):** 901–905, 959, 1043–1050, 1249
- **Severity:** High
- **Affected Viewports:** `320px`, `375px`, `430px`
- **Existing Behavior:** Search result button (`flex items-center justify-between gap-4`, line 901) with non-wrapping inner badge row (line 904) and `shrink-0` balance overflows horizontally on mobile. Selected student header (line 959) lacks `flex-wrap min-w-0`; unpaid invoices `<th>` headers lack `whitespace-nowrap`; confirmation modal (line 1249) lacks `max-h-[90vh] overflow-y-auto`.
- **Expected Behavior:** Search results and student header wrap/stack cleanly; table headers stay single-line; modal is `90vh`-bounded.
- **Recommended Minimum Fix:** Use `flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4` on line 901, `min-w-0` on line 903, `flex-wrap` on lines 904 & 959, `whitespace-nowrap` on `<th>`, and `max-h-[90vh] overflow-y-auto` on line 1249.

#### 20. `madrasanexa/src/pages/madrasa-admin/InvoicesPage.tsx`
- **Component:** `InvoicesPage`
- **Line(s):** 410–420, 506–514, 537, 569
- **Severity:** High
- **Affected Viewports:** `320px`, `375px`, `768px`
- **Existing Behavior:** Mobile card footer (line 506) collides/overflows on `320px`–`375px`; pagination (line 537) lacks `flex-col sm:flex-row gap-3`; void modal (line 569) lacks `max-h-[90vh] overflow-y-auto`; `<th>` headers lack `whitespace-nowrap`.
- **Expected Behavior:** Mobile card metadata wraps cleanly, pagination stacks on mobile, modal scrolls within `90vh`, and `<th>` stay single-line.
- **Recommended Minimum Fix:** Add `flex-wrap gap-2` on line 506, `flex-col sm:flex-row gap-3` on line 537, `max-h-[90vh] overflow-y-auto` on line 569, and `whitespace-nowrap` on `<th>`.

#### 21. `madrasanexa/src/pages/madrasa-admin/PaymentsPage.tsx`
- **Component:** `PaymentsPage`
- **Line(s):** 149, 321–330, 421, 449
- **Severity:** Medium
- **Affected Viewports:** `320px`, `375px`, `768px`, `1024px`
- **Existing Behavior:** `grid-cols-2 lg:grid-cols-5` (line 149) cramps KPI cards at `320px` and `1024px`; `<th>` headers lack `whitespace-nowrap`; pagination (line 421) lacks `flex-col sm:flex-row gap-3`; void modal (line 449) lacks `max-h-[90vh] overflow-y-auto`.
- **Expected Behavior:** Responsive KPI breakpoints, single-line `<th>`, stacked mobile pagination, and `90vh`-bounded modal.
- **Recommended Minimum Fix:** Change line 149 to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5`, add `whitespace-nowrap` to `<th>`, `flex-col sm:flex-row gap-3` to line 421, and `max-h-[90vh] overflow-y-auto` to line 449.

#### 22. `madrasanexa/src/pages/madrasa-admin/StudentAddPage.tsx`
- **Component:** `StudentAddPage`
- **Line(s):** 307, 560–575
- **Severity:** Medium
- **Affected Viewports:** `320px`
- **Existing Behavior:** Action bar (`flex items-center justify-end gap-3`, line 560) with `Cancel` + `Complete Student Registration` (~307px) crowds/overflows at `320px`; class summary banner (line 307) lacks `flex-wrap gap-2`.
- **Expected Behavior:** Buttons stack cleanly on narrow mobile viewports.
- **Recommended Minimum Fix:** Change line 560 to `flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2` and add `flex-wrap gap-2` to line 307.

#### 23. `madrasanexa/src/components/students/StudentRecordsPanels.tsx`
- **Component:** `StudentRecordsPanels`
- **Line(s):** 719, 897, 1584, 1631, 1891
- **Severity:** Medium
- **Affected Viewports:** `320px`, `375px`, `640px`–`767px`
- **Existing Behavior:** Selected filename `<span>` uses `max-w-xs` (320px) inside modals (lines 1584, 1891), overflowing `320px`–`375px` modal widths; Verify/Reject modal (line 1631) lacks `max-h-[90vh] overflow-y-auto`; 5-col KPI grids (`grid-cols-2 sm:grid-cols-5`, lines 719, 897) squeeze cards at `640px`–`767px`.
- **Expected Behavior:** Filenames truncate inside modal bounds, modal is `90vh`-bounded, and KPI grids step through 3 columns before 5.
- **Recommended Minimum Fix:** Use `max-w-[180px] sm:max-w-xs` on lines 1584 & 1891, add `max-h-[90vh] overflow-y-auto` on line 1631, and use `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` on lines 719 & 897.

#### 24. `madrasanexa/src/components/subscription/BankDetailsCard.tsx`
- **Component:** `BankDetailsCard`
- **Line(s):** 62, 113, 140
- **Severity:** Medium
- **Affected Viewports:** `320px`, `375px`
- **Existing Behavior:** Payable context box (`flex items-center gap-4 shrink-0`, line 62) prevents shrinking/wrapping and overflows on long plan names at `320px`–`375px`.
- **Expected Behavior:** Context box wraps cleanly within card bounds.
- **Recommended Minimum Fix:** Change line 62 to `p-3.5 rounded-xl bg-[#F7F6F1] border border-[#E7E9EE] flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 min-w-0` and add `min-w-0` on lines 113 & 140.

#### 25. `madrasanexa/src/pages/madrasa-admin/SubscriptionPage.tsx`
- **Component:** `SubscriptionPage`
- **Line(s):** 505–511, 545, 593–597, 637–640
- **Severity:** Low
- **Affected Viewports:** `320px`, `375px`, `430px`, `768px`
- **Existing Behavior:** Table `<th>` headers in the three history tables lack `whitespace-nowrap` and wrap awkwardly inside `overflow-x-auto`.
- **Expected Behavior:** Table headers stay single-line during horizontal scroll.
- **Recommended Minimum Fix:** Add `whitespace-nowrap` to the `<th>` elements (and `View Receipt` button on line 545).

---

### D3. Settings, Portal CMS, Shared & Remaining Super Admin

#### 26. `madrasanexa/src/components/settings/EmailSenderSettingsTab.tsx`
- **Component:** `EmailSenderSettingsTab`
- **Line(s):** 506–519
- **Severity:** High
- **Affected Viewports:** `320px`, `375px`, `430px`
- **Existing Behavior:** Gmail App Password guidance banner uses `flex items-start justify-between gap-3` with a `shrink-0` `"How to create an App Password?"` button (~190px), crushing the left text or overflowing horizontally on mobile.
- **Expected Behavior:** Guidance text and toggle button stack vertically on mobile.
- **Recommended Minimum Fix:** Change line 506 to `flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-3`.

#### 27. `madrasanexa/src/components/portal-cms/CurriculumManagerTab.tsx`
- **Component:** `CurriculumManagerTab`
- **Line(s):** 798–820, 856–888 (High); 994–1130 (Medium)
- **Severity:** High
- **Affected Viewports:** `320px`, `375px`, `430px`
- **Existing Behavior:**
  - Lines 798–820 & 856–888: Level header (`flex items-center space-x-3`) and subject row (`flex items-center space-x-2 flex-1`) with unconstrained `<input>`s and badges overflow nested cards on `320px`–`430px`.
  - Lines 994 & 1087: Programme and Category modals lack `max-h-[90vh] overflow-y-auto`, and line 1011 uses `grid grid-cols-2 gap-3` without a single-column mobile breakpoint.
- **Expected Behavior:** Inputs/badges wrap cleanly on mobile; modals scroll within `90vh` and stack form columns on mobile.
- **Recommended Minimum Fix:** Use `flex-wrap gap-2` on lines 798 & 856 with `min-w-0 flex-1` / `min-w-[140px]` on inputs; add `max-h-[90vh] overflow-y-auto` on lines 994 & 1087; change line 1011 to `grid grid-cols-1 sm:grid-cols-2 gap-3`.

#### 28. `madrasanexa/src/pages/madrasa-admin/MadrasaHomepageCmsPage.tsx`
- **Component:** `MadrasaHomepageCmsPage`
- **Line(s):** 1607–1636 (High); 837–854, 1557–1572 (Medium)
- **Severity:** High
- **Affected Viewports:** `320px`, `375px`, `430px`
- **Existing Behavior:** Notice item action bar (`flex items-center space-x-2 shrink-0`, line 1607, ~235px wide) overflows the card on `320px`–`375px`; notices header (line 1557) lacks `flex-col sm:flex-row`; `<h1>` + status badge (line 837) lacks `flex-wrap`; `{publicUrl}` (line 854) lacks `break-all`.
- **Expected Behavior:** Headers and action groups stack/wrap cleanly; long public URLs wrap without overflow.
- **Recommended Minimum Fix:** Use `flex-wrap items-center justify-end gap-2 w-full sm:w-auto` on line 1607, `flex-col sm:flex-row sm:items-center justify-between gap-4` on line 1557, `flex-wrap items-center gap-2` on line 837, and `break-all` on line 854.

#### 29. `madrasanexa/src/pages/madrasa-admin/SettingsPage.tsx`
- **Component:** `SettingsPage`
- **Line(s):** 668–682
- **Severity:** Medium
- **Affected Viewports:** `320px`, `375px`, `430px`
- **Existing Behavior:** Password Security banner (`flex items-center justify-between`, line 668) lacks `flex-col sm:flex-row gap-3`, squeezing description text and wrapping the `Change Password` link awkwardly.
- **Expected Behavior:** Description and button stack on mobile and sit side-by-side on `sm+`.
- **Recommended Minimum Fix:** Change line 668 to `sm:col-span-2 p-4 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3` and add `shrink-0 w-fit` to line 677.

#### 30. `madrasanexa/src/components/settings/DateTimeSettingsTab.tsx`
- **Component:** `DateTimeSettingsTab`
- **Line(s):** 225, 572–600
- **Severity:** Medium
- **Affected Viewports:** `320px`
- **Existing Behavior:** Clock card has unconditional `min-w-[240px]` (line 225) and action buttons (`Reset to Saved`, `Save Settings`, line 572) lack `flex-wrap`, risking overflow at `320px`.
- **Expected Behavior:** Clock card adapts to full width on mobile and action buttons wrap cleanly.
- **Recommended Minimum Fix:** Use `w-full md:w-auto md:min-w-[240px]` on line 225 and `flex flex-wrap items-center justify-end gap-3 pt-2` on line 572.

#### 31. `madrasanexa/src/components/portal-cms/StaffManagerTab.tsx`
- **Component:** `StaffManagerTab`
- **Line(s):** 366, 382–393
- **Severity:** Medium
- **Affected Viewports:** `320px`, `375px`, `430px`
- **Existing Behavior:** Staff name, `ustadhCode` badge, and role label sit in `flex items-center space-x-2` without `flex-wrap` or `min-w-0` on parent containers, pushing badges off-card on long names.
- **Expected Behavior:** Identity metadata wraps cleanly inside card bounds.
- **Recommended Minimum Fix:** Add `min-w-0` on line 366, `min-w-0 flex-1` on line 382, and `flex flex-wrap items-center gap-1.5 sm:gap-2` on line 383.

#### 32. `madrasanexa/src/components/portal-cms/ThemeCustomizerTab.tsx`
- **Component:** `ThemeCustomizerTab`
- **Line(s):** 381–392, 797–809
- **Severity:** Medium
- **Affected Viewports:** `320px`, `375px`, `430px`
- **Existing Behavior:** Heading + status pill (line 381) lacks `flex-wrap`; preview wrapper (`flex justify-center overflow-x-auto`, line 797) clips the left edge of `375px`/`600px` simulated frames on `320px` viewports.
- **Expected Behavior:** Heading wraps cleanly and overflowing preview frames remain scrollable from left to right.
- **Recommended Minimum Fix:** Add `flex-wrap` on line 381; remove `flex justify-center` on line 797 and add `mx-auto` on line 799.

#### 33. `madrasanexa/src/pages/madrasa-admin/AboutUsPage.tsx`
- **Component:** `MadrasaAdminAboutUsPage`
- **Line(s):** 66–70
- **Severity:** Medium
- **Affected Viewports:** `320px`, `375px`
- **Existing Behavior:** `"About MadrasaNexa"` `<h1>` and `"Global Platform"` badge sit in `flex items-center gap-2` without `flex-wrap` (~298px combined inside `p-6` card at `320px`).
- **Expected Behavior:** Title and badge wrap cleanly on narrow viewports.
- **Recommended Minimum Fix:** Change line 66 to `flex flex-wrap items-center gap-2`.

#### 34. `madrasanexa/src/pages/madrasa-admin/MadrasaAdminWorkspace.tsx` & `madrasanexa/src/pages/super-admin/SuperAdminWorkspace.tsx`
- **Components:** `MadrasaAdminWorkspace`, `SuperAdminWorkspace`
- **Line(s):** `MadrasaAdminWorkspace.tsx:51, 91`; `SuperAdminWorkspace.tsx:59`
- **Severity:** Medium
- **Affected Viewports:** `320px`, `375px`, `430px`, `768px`
- **Existing Behavior:** `{user?.email}` (`font-mono`) in `grid-cols-1 sm:grid-cols-3` lacks `break-all`, overflowing narrow cards (especially at `sm:`–`768px`). `MadrasaAdminWorkspace.tsx:51` expiring-soon heading + badge also lacks `flex-wrap`.
- **Expected Behavior:** Long emails wrap cleanly within cards.
- **Recommended Minimum Fix:** Add `break-all` to email divs at `MadrasaAdminWorkspace.tsx:91` and `SuperAdminWorkspace.tsx:59`, and `flex-wrap` at `MadrasaAdminWorkspace.tsx:51`.

#### 35. `madrasanexa/src/pages/madrasa-admin/ActivityPage.tsx`
- **Component:** `ActivityPage`
- **Line(s):** 180–200
- **Severity:** Low
- **Affected Viewports:** `320px`, `375px`
- **Existing Behavior:** Pagination footer (`flex items-center justify-between`, line 180) cramps summary text next to Prev/Next buttons at `320px`.
- **Expected Behavior:** Pagination summary and buttons stack cleanly on small screens.
- **Recommended Minimum Fix:** Change line 180 to `p-4 border-t border-[#E7E9EE] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#7C8A9A]`.

#### 36. `madrasanexa/src/pages/super-admin/SubscriptionsPage.tsx`
- **Component:** `SubscriptionsPage`
- **Line(s):** 145–173
- **Severity:** Low
- **Affected Viewports:** `768px`, `1024px`
- **Existing Behavior:** Actions `<td>` uses `text-right space-x-2` without `whitespace-nowrap`, allowing action buttons to wrap onto separate lines with uneven `ml-2` spacing.
- **Expected Behavior:** Action buttons stay aligned in one row inside the scrollable table.
- **Recommended Minimum Fix:** Wrap actions in `<div className="inline-flex items-center justify-end gap-2">` inside `<td className="px-5 py-3 text-right whitespace-nowrap">`.

---

## E. Already Completed & Clean Areas

In addition to all modules completed in Phase 1 and Batches 2A, 2B, 2C-1, 2C-2, and 2C-3, the following **45 newly audited files** already follow sound responsive patterns and require **no modifications**:

- **Public & Auth (29 files):** `HomePage.tsx`, `PricingPage.tsx`, `MadrasaPublicPage.tsx`, `LoginPage.tsx`, `RegisterPage.tsx`, `ChangePasswordPage.tsx`, `PublicFooter.tsx`, `HeroSection.tsx`, `HeroMediaSlider.tsx`, `ProductShowcaseSection.tsx`, `ProductPreview.tsx`, `QuranVerseMarquee.tsx`, `TrustStrip.tsx`, `FeaturesSection.tsx`, `HowItWorksSection.tsx`, `PricingSection.tsx`, `SecuritySection.tsx`, `CTASection.tsx`, `ContactSection.tsx`, `FloatingWhatsAppButton.tsx`, `MadrasaPublicHero.tsx`, `MadrasaPublicMissionVision.tsx`, `MadrasaPublicStats.tsx`, `MadrasaPublicStaff.tsx`, `MadrasaPublicEvents.tsx`, `MadrasaPublicNotices.tsx`, `MadrasaPublicAdmissionsCTA.tsx`, `MadrasaPublicContact.tsx`, `MadrasaPublicFooter.tsx`.
- **Expense, Students & Subscription (7 files):** `BudgetVsActualChart.tsx`, `ExpenseTrendChart.tsx`, `StudentEditPage.tsx` (optional minor polish only), `SubscriptionRequiredPage.tsx`, `PlanCard.tsx`, `PlanFeatureDrawer.tsx`, `ReceiptUploadForm.tsx`.
- **Settings, Portal CMS, Shared & Super Admin (9 files):** `NotificationSettingsTab.tsx`, `AddStaffModal.tsx`, `madrasa-admin/AnnouncementsPage.tsx`, `MarkingHubPage.tsx`, `MarkingFilters.tsx`, `AnnouncementBell.tsx`, `InstitutionalLiveClock.tsx`, `super-admin/MadrasasPage.tsx`, `HomepageImageUploader.tsx`.

---

## F. Proposed Batch 2D Implementation Plan

The **38 files** with confirmed defects group cleanly into **4 small, non-overlapping batches**:

### Batch 2D-1: Public Website, Madrasa Public Portal & Auth
- **Exact File List (10 files):**
  1. `madrasanexa/src/components/public/PublicNavbar.tsx`
  2. `madrasanexa/src/components/madrasa-public/MadrasaPublicNavbar.tsx`
  3. `madrasanexa/src/components/public/ImageLightbox.tsx`
  4. `madrasanexa/src/pages/public/AboutUsPage.tsx`
  5. `madrasanexa/src/pages/public/MadrasaAdmissionsPage.tsx`
  6. `madrasanexa/src/pages/auth/SetupPasswordPage.tsx`
  7. `madrasanexa/src/components/about-us/AboutUsContentView.tsx`
  8. `madrasanexa/src/components/public/AboutSection.tsx`
  9. `madrasanexa/src/components/madrasa-public/MadrasaPublicAbout.tsx`
  10. `madrasanexa/src/components/madrasa-public/MadrasaPublicCurriculum.tsx`
- **Defect Count:** 10 files (5 High, 2 Medium, 3 Low max severity)
- **Minimal Proposed Changes:** Breakpoint padding/subtitle visibility on navbars, `max-h-[calc(100dvh-5rem)] overflow-y-auto` on mobile drawer, lightbox close button placement & `overflow-y-auto`, `flex-wrap`/`flex-col sm:flex-row` on headers/receipts, `break-all`/`min-w-0` on emails/filenames, and `grid-cols-1 sm:grid-cols-2 md:grid-cols-4` on metrics.
- **Testing Requirements:** `npm run lint`, `npm run build`, and live browser check at `320px`, `375px`, `1024px` (including mobile menu scroll, lightbox open, admissions receipt modal, and About Us language switcher).
- **Risks & Dependencies:** Low; pure Tailwind layout/wrapping classes with zero API or routing changes.

### Batch 2D-2: Expense Analysis Module
- **Exact File List (9 files):**
  1. `madrasanexa/src/pages/madrasa-admin/ExpenseAnalysisPage.tsx`
  2. `madrasanexa/src/components/expense-analysis/ExpenseBudgetModal.tsx`
  3. `madrasanexa/src/components/expense-analysis/ExpenseCategoryManager.tsx`
  4. `madrasanexa/src/components/expense-analysis/ExpenseEntryModal.tsx`
  5. `madrasanexa/src/components/expense-analysis/ExpenseHistoryTable.tsx`
  6. `madrasanexa/src/components/expense-analysis/ExpenseSummaryCards.tsx`
  7. `madrasanexa/src/components/expense-analysis/MonthlyComparisonTable.tsx`
  8. `madrasanexa/src/components/expense-analysis/MonthlyInsightModal.tsx`
  9. `madrasanexa/src/components/expense-analysis/CostReviewPanel.tsx`
- **Defect Count:** 9 files (1 High, 6 Medium, 2 Low)
- **Minimal Proposed Changes:** `flex-wrap` on export bar and cost review rows, `flex-col sm:flex-row` on budget modal footer/headers/pagination, `grid-cols-1 sm:grid-cols-3` in entry modal, `lg:grid-cols-3 xl:grid-cols-5` on summary cards, `max-h-[90vh] overflow-y-auto` on modals, and `whitespace-nowrap` on `<th>` headers.
- **Testing Requirements:** `npm run lint`, `npm run build`, and live check of budget/entry/insight/void modals at `320px`–`1024px`.
- **Risks & Dependencies:** Low; no calculation, chart data, or export logic touched.

### Batch 2D-3: Fee POS, Invoices, Payments, Students & Subscription
- **Exact File List (7 files):**
  1. `madrasanexa/src/pages/madrasa-admin/FeePOSPage.tsx`
  2. `madrasanexa/src/pages/madrasa-admin/InvoicesPage.tsx`
  3. `madrasanexa/src/pages/madrasa-admin/PaymentsPage.tsx`
  4. `madrasanexa/src/pages/madrasa-admin/StudentAddPage.tsx`
  5. `madrasanexa/src/components/students/StudentRecordsPanels.tsx`
  6. `madrasanexa/src/components/subscription/BankDetailsCard.tsx`
  7. `madrasanexa/src/pages/madrasa-admin/SubscriptionPage.tsx`
- **Defect Count:** 7 files (2 High, 4 Medium, 1 Low)
- **Minimal Proposed Changes:** Responsive search result & mobile card footers, `flex-col sm:flex-row` pagination/form action bars, `max-h-[90vh] overflow-y-auto` on modals, `max-w-[180px] sm:max-w-xs` on filename chips, `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5` on Payments KPI grid, `flex-wrap` on `BankDetailsCard` context box, and `whitespace-nowrap` on `<th>` headers.
- **Testing Requirements:** `npm run lint`, `npm run build`, and live check of Fee POS search dropdown, Invoices mobile cards, and Student certificate modals at `320px`–`1024px`.
- **Risks & Dependencies:** Low; financial calculations, payment submission, and form validation remain untouched.

### Batch 2D-4: Settings, Portal CMS, Workspaces, Activity & Super Admin Subscriptions
- **Exact File List (12 files):**
  1. `madrasanexa/src/components/settings/EmailSenderSettingsTab.tsx`
  2. `madrasanexa/src/pages/madrasa-admin/SettingsPage.tsx`
  3. `madrasanexa/src/components/settings/DateTimeSettingsTab.tsx`
  4. `madrasanexa/src/components/portal-cms/CurriculumManagerTab.tsx`
  5. `madrasanexa/src/pages/madrasa-admin/MadrasaHomepageCmsPage.tsx`
  6. `madrasanexa/src/components/portal-cms/StaffManagerTab.tsx`
  7. `madrasanexa/src/components/portal-cms/ThemeCustomizerTab.tsx`
  8. `madrasanexa/src/pages/madrasa-admin/AboutUsPage.tsx`
  9. `madrasanexa/src/pages/madrasa-admin/MadrasaAdminWorkspace.tsx`
  10. `madrasanexa/src/pages/super-admin/SuperAdminWorkspace.tsx`
  11. `madrasanexa/src/pages/madrasa-admin/ActivityPage.tsx`
  12. `madrasanexa/src/pages/super-admin/SubscriptionsPage.tsx`
- **Defect Count:** 12 files (3 High, 7 Medium, 2 Low)
- **Minimal Proposed Changes:** `flex-col sm:flex-row` on settings banners/headers/pagination, `flex-wrap` & `min-w-0` on CMS curriculum/staff/title rows, `max-h-[90vh] overflow-y-auto` & `sm:grid-cols-2` on CMS modals, `overflow-x-auto` fix in `ThemeCustomizerTab`, `break-all` on long emails/slugs, and `whitespace-nowrap` inline-flex actions in `SubscriptionsPage`.
- **Testing Requirements:** `npm run lint`, `npm run build`, and live check of Portal CMS curriculum/notices/theme preview and Settings tabs at `320px`–`768px`.
- **Risks & Dependencies:** Low; no CMS persistence, RBAC, or settings API logic altered.

---

## G. Final Recommendation

**SMALL REMAINING FIXES REQUIRED.**
