# CLEAN MACHINE INSTALLATION & VERIFICATION GUIDE

## 1. Prerequisites

Ensure your host system meets the following standard prerequisites:
- **Node.js**: v20.x or v22.x or v24.x LTS ([nodejs.org](https://nodejs.org/))
- **npm**: v10.x or higher (included with Node.js)
- **Git**: v2.30+ ([git-scm.com](https://git-scm.com/))
- **OS**: Windows, macOS, or Linux.
- **Port Availability**: Port `5000` (Backend API) and Port `5173` (Frontend UI).

*Note: No external API keys, database credentials, or proprietary software licenses are required. Martian Map includes built-in in-memory fallback repositories and deterministic benchmark datasets for 100% offline functionality.*

---

## 2. Installation Steps

### Step 1: Clone Repository
```bash
git clone https://github.com/shrutirai29/nasa.git
cd nasa
```

### Step 2: Install Dependencies
```bash
# Install root, backend, and frontend packages
npm install
npm --prefix backend install
npm --prefix frontend install
```

### Step 3: Run Full Automated Test Suite
```bash
npm test
```
*Expected Output:*
```text
Test Files  30 passed (30)
     Tests  121 passed (121)
```

### Step 4: Verify Production Builds
```bash
# Verify backend TypeScript compilation
npm --prefix backend run build

# Verify frontend Vite production bundle
npm --prefix frontend run build
```

---

## 3. Starting the Platform

### Terminal 1: Start Backend API Server
```bash
npm --prefix backend run dev
```
*The backend API will start on `http://localhost:5000`.*

### Terminal 2: Start Frontend Development Server
```bash
npm --prefix frontend run dev
```
*The frontend user interface will start on `http://localhost:5173`.*

---

## 4. Verification Checkpoints

Once both servers are running:
1. Open [`http://localhost:5173`](http://localhost:5173) in any browser.
2. Navigate to **Judging Demo** ([`http://localhost:5173/demo`](http://localhost:5173/demo)).
3. Click **▶ MARSWALK-001** to verify the end-to-end hazard detection, autonomous pause, and detour approval workflow.
4. Click **RUN ZERO-TRUST SECURITY AUDIT** to verify RBAC enforcement and replay attack rejection.
5. Click **VERIFY CHAIN** to cryptographically validate the SHA-256 audit ledger.
