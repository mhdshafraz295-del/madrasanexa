# MadrasaNexa Multi-Tenant Security & Isolation Guidelines

## 1. Core Tenant Principle
MadrasaNexa is a SaaS platform serving multiple Madrasas from a single shared database.
Every tenant's workspace, students, classes, invoices, payments, receipts, settings, files, and activity logs must be strictly isolated.

> **RULE #1**: For MADRASA_ADMIN, the **ONLY** authoritative tenant identifier is eq.auth.madrasaId (or eq.tenant.madrasaId).
> Never trust eq.body.madrasaId, eq.query.madrasaId, eq.params.madrasaId, custom headers, or frontend state.

---

## 2. Safe Query Patterns (Tenant Prisma Helpers)
Always use the helpers in server/src/lib/tenant-prisma.js instead of unprotected Prisma calls.

### Finding a Record by ID
❌ **UNSAFE**:
`javascript
// Vulnerable to IDOR: Any tenant admin can fetch this record if they guess the ID!
const student = await prisma.student.findUnique({
  where: { id: studentId }
});
`

✅ **SAFE**:
`javascript
import { findTenantRecordOrThrow } from '../lib/tenant-prisma.js';

// Automatically adds { id: studentId, madrasaId: req.tenant.madrasaId }
// Throws generic 404 (NotFoundError) if not found or if owned by another Madrasa
const student = await findTenantRecordOrThrow(
  prisma.student,
  studentId,
  req.tenant.madrasaId
);
`

### Filtering & Listing Records
❌ **UNSAFE**:
`javascript
const students = await prisma.student.findMany({
  where: { status: 'ACTIVE' } // Leaks all Madrasas' students!
});
`

✅ **SAFE**:
`javascript
import { tenantWhere } from '../lib/tenant-prisma.js';

const students = await prisma.student.findMany({
  where: tenantWhere(req.tenant.madrasaId, { status: 'ACTIVE' })
});
`

### Preventing Data Leakage via Pagination & Counts
Always use 	enantPaginationWhere to ensure count() and indMany() run against the exact same tenant filter:
`javascript
import { tenantPaginationWhere } from '../lib/tenant-prisma.js';

const { where } = tenantPaginationWhere(req.tenant.madrasaId, { status: 'ACTIVE' });
const [total, items] = await Promise.all([
  prisma.student.count({ where }),
  prisma.student.findMany({ where, skip, take }),
]);
`

---

## 3. IDOR Protection & Generic 404 Behavior
When a Madrasa Admin attempts to view, edit, or delete a record that belongs to another Madrasa:
- **DO NOT** throw 403 Forbidden: Belongs to another Madrasa.
- **DO** throw 404 Not Found: Resource not found..

Revealing a 403 confirms the record exists under another institution (Resource Enumeration Vulnerability).

---

## 4. Nested Resource Cross-Tenant Validation
When creating or updating records that reference foreign keys (e.g., assigning a Student to a Class, or creating an Invoice for a Student), **always validate that the related entity belongs to the authenticated tenant** before assignment:

`javascript
import { validateRelatedTenantResource } from '../lib/tenant-prisma.js';

// If classId belongs to another Madrasa, throws generic 404
await validateRelatedTenantResource(
  prisma.class,
  req.body.classId,
  req.tenant.madrasaId,
  'Class'
);
`

---

## 5. Super Admin Platform Operations
Super Admin (SUPER_ADMIN) operates across the platform with eq.auth.madrasaId = null.
- Never fake a tenant on eq.auth.
- When an endpoint explicitly manages a specific Madrasa, use esolvePlatformTargetMadrasa('madrasaId').
- This attaches eq.platformTarget = { madrasaId, ... } without mutating eq.auth.madrasaId.

---

## 6. Cloudflare R2 Tenant Key Security
When constructing R2 object keys, use uildMadrasaKey(trustedMadrasaId, category, filename) from server/src/services/r2.service.js:
- Ensures keys strictly follow madrasas/{madrasaId}/{category}/{filename}.
- Sanitizes filenames against directory traversal (.., \, null bytes).
