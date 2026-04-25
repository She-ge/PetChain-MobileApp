# PetChain Mobile App — Architecture

This document provides visual diagrams of the PetChain mobile app architecture, covering the high-level system overview, data flow, and component relationships.

---

## 1. High-Level Architecture

```mermaid
graph TB
    subgraph Mobile["📱 Mobile App (React Native / Expo)"]
        direction TB
        subgraph Screens["Screens"]
            S1[OnboardingScreen]
            S2[QRScannerScreen]
            S3[ManualEntryScreen]
            S4[EmergencyContactsScreen]
        end

        subgraph FrontendServices["Frontend Services"]
            FS1[authService]
            FS2[petService]
            FS3[medicalRecordService]
            FS4[appointmentService]
            FS5[medicationService]
            FS6[syncService]
            FS7[blockchainService]
            FS8[emergencyService]
            FS9[notificationService]
            FS10[qrCodeService]
        end

        subgraph LocalStorage["Local Storage"]
            LS1[(AsyncStorage\nSync Queue / Conflicts)]
            LS2[(Keychain / SecureStore\nJWT Tokens)]
        end

        subgraph Utils["Utilities"]
            U1[networkMonitor]
            U2[encryption / crypto]
            U3[validators]
        end
    end

    subgraph Backend["🖥️ Backend API (Node.js / Express)"]
        direction TB
        subgraph BackendServices["Backend Services"]
            BS1[authService]
            BS2[petService]
            BS3[appointmentService]
            BS4[medicationService]
            BS5[syncService]
            BS6[storageService]
            BS7[loggerService]
        end

        subgraph BackendMiddleware["Middleware"]
            MW1[apiInterceptors]
            MW2[errorHandler]
        end

        subgraph CacheLayer["Cache"]
            CL1[(cacheManager)]
        end
    end

    subgraph External["☁️ External Services"]
        EX1[(Stellar Blockchain)]
        EX2[Expo Notifications]
        EX3[Geolocation API]
        EX4[OAuth Providers\nGoogle · Apple · Facebook]
    end

    Screens --> FrontendServices
    FrontendServices --> LS1
    FS1 --> LS2
    FrontendServices --> Utils
    U1 --> FS6

    FrontendServices -- "HTTPS / REST" --> BackendMiddleware
    BackendMiddleware --> BackendServices
    BackendServices --> CL1

    BS1 --> EX4
    FS7 -- "Blockchain API" --> EX1
    FS9 --> EX2
    FS8 --> EX3
```

---

## 2. Data Flow Diagram

### 2a. Authentication Flow

```mermaid
sequenceDiagram
    actor User
    participant App as Mobile App
    participant Auth as authService
    participant KC as Keychain / SecureStore
    participant API as Backend API
    participant OAuth as OAuth Provider

    User->>App: Enter credentials / tap OAuth
    App->>Auth: login(email, password)
    Auth->>API: POST /auth/login
    API-->>Auth: { token, refreshToken, user }
    Auth->>KC: Store token + refreshToken securely
    Auth-->>App: AuthSession

    Note over App,API: Subsequent requests
    App->>Auth: makeRequest()
    Auth->>KC: Read token
    KC-->>Auth: JWT
    Auth->>API: Request + Authorization: Bearer {JWT}
    API-->>App: Response

    Note over App,API: Token expiry / 401
    API-->>Auth: 401 Unauthorized
    Auth->>API: POST /auth/refresh { refreshToken }
    API-->>Auth: { token }
    Auth->>KC: Update stored token
    Auth->>API: Retry original request
    API-->>App: Response
```

### 2b. Offline Sync Flow

```mermaid
sequenceDiagram
    participant App as Mobile App
    participant NM as networkMonitor
    participant Sync as syncService
    participant AS as AsyncStorage
    participant API as Backend API

    App->>Sync: enqueue(type, action, data)
    Sync->>AS: Persist to sync queue

    NM-->>Sync: Network restored
    Sync->>Sync: push() — process queue
    loop For each queued item
        Sync->>API: POST/PUT/DELETE entity
        alt Success
            Sync->>AS: Remove item from queue
        else Failure (retries < 3)
            Sync->>AS: Increment retry count
        else Max retries exceeded
            Sync->>AS: Mark as failed
        end
    end

    Sync->>API: pull() — fetch latest data
    API-->>Sync: Server state
    alt Conflict detected
        Sync->>AS: Store ConflictRecord
        Note over Sync: last-write-wins or manual resolution
    else No conflict
        Sync->>App: Update local state
    end
```

### 2c. Blockchain Medical Record Flow

```mermaid
sequenceDiagram
    participant App as Mobile App
    participant BC as blockchainService
    participant Crypto as crypto (SHA256)
    participant API as Backend API
    participant Stellar as Stellar Blockchain

    App->>BC: storeRecord(medicalRecord)
    BC->>Crypto: hash(canonicalJSON(record))
    Crypto-->>BC: SHA256 hash
    BC->>API: POST /blockchain/records { hash, petId, recordId }
    API->>Stellar: Anchor hash as transaction
    Stellar-->>API: { txHash, ledger }
    API-->>BC: { txHash, isVerified }
    BC-->>App: Blockchain receipt

    Note over App,Stellar: Verification
    App->>BC: verifyRecord(recordId)
    BC->>API: GET /blockchain/records/{recordId}/verify
    API->>Stellar: Lookup transaction
    Stellar-->>API: On-chain hash
    API-->>BC: { isValid, tamperDetected }
    BC-->>App: Verification result
```

### 2d. QR Code Flow

```mermaid
sequenceDiagram
    actor User
    participant Scanner as QRScannerScreen
    participant QR as qrCodeService
    participant Pet as petService
    participant API as Backend API

    User->>Scanner: Point camera at QR code
    Scanner->>QR: validateQRData(rawData)
    QR->>QR: Verify checksum (CryptoJS)
    alt Valid PetChain QR
        QR-->>Scanner: { petId, recordId }
        Scanner->>Pet: getPetById(petId)
        Pet->>API: GET /pets/{petId}
        API-->>Pet: Pet data
        Pet-->>Scanner: Pet profile
        Scanner-->>User: Display pet records
    else Invalid / tampered QR
        QR-->>Scanner: ValidationError
        Scanner-->>User: Show error + manual entry option
    end
```

---

## 3. Component Relationship Diagram

### 3a. Frontend Service Dependencies

```mermaid
graph LR
    subgraph Screens
        OS[OnboardingScreen]
        QS[QRScannerScreen]
        MS[ManualEntryScreen]
        ES[EmergencyContactsScreen]
    end

    subgraph Services
        AC[apiClient\nAxios + interceptors]
        AU[authService]
        PS[petService]
        MR[medicalRecordService]
        AP[appointmentService]
        MD[medicationService]
        SY[syncService]
        BL[blockchainService]
        EM[emergencyService]
        NT[notificationService]
        QR[qrCodeService]
    end

    subgraph Storage
        KC[(Keychain)]
        AS[(AsyncStorage)]
    end

    subgraph External
        API[Backend API]
        STL[Stellar]
        GEO[Geolocation]
        NOTIF[Expo Notifications]
    end

    OS --> AU
    QS --> QR
    QS --> PS
    MS --> PS
    MS --> MR
    ES --> EM

    AU --> AC
    AU --> KC
    PS --> AC
    MR --> AC
    AP --> AC
    MD --> AC
    SY --> AC
    SY --> AS
    BL --> AC
    BL --> STL
    EM --> GEO
    EM --> AS
    NT --> NOTIF
    NT --> AS

    AC --> API
```

### 3b. Data Model Relationships

```mermaid
erDiagram
    USER {
        string id PK
        string email
        string name
        string phone
        string role
        string authProvider
        bool isEmailVerified
    }

    PET {
        string id PK
        string name
        string species
        string breed
        string ownerId FK
        string microchipId
        string qrCode
        date dateOfBirth
    }

    MEDICAL_RECORD {
        string id PK
        string petId FK
        string vetId FK
        string type
        string diagnosis
        string treatment
        date visitDate
        string blockchainTxHash
        bool isBlockchainVerified
    }

    APPOINTMENT {
        string id PK
        string petId FK
        string vetId FK
        string type
        string status
        date date
        string time
        int durationMinutes
    }

    MEDICATION {
        string id PK
        string petId FK
        string name
        string dosage
        string frequency
        string status
        date startDate
        date endDate
    }

    EMERGENCY_CONTACT {
        string id PK
        string name
        string phoneNumber
        string type
        bool available24h
    }

    SYNC_ITEM {
        string id PK
        string entityType
        string action
        int timestamp
        int retries
    }

    USER ||--o{ PET : "owns"
    PET ||--o{ MEDICAL_RECORD : "has"
    PET ||--o{ APPOINTMENT : "has"
    PET ||--o{ MEDICATION : "has"
    MEDICAL_RECORD }o--|| USER : "recorded by vet"
    APPOINTMENT }o--|| USER : "assigned to vet"
    SYNC_ITEM }o--|| PET : "queues changes for"
    SYNC_ITEM }o--|| MEDICAL_RECORD : "queues changes for"
    SYNC_ITEM }o--|| APPOINTMENT : "queues changes for"
    SYNC_ITEM }o--|| MEDICATION : "queues changes for"
```

### 3c. Backend Service & Middleware Structure

```mermaid
graph TD
    subgraph Middleware["Middleware Layer"]
        AI[apiInterceptors\nAuth header injection\nRate limiting]
        EH[errorHandler\nCentralised error responses]
    end

    subgraph Services["Service Layer"]
        AS2[authService\nJWT · OAuth · Refresh]
        PS2[petService\nCRUD · QR lookup]
        AP2[appointmentService\nScheduling · Status]
        MD2[medicationService\nSchedules · Reminders]
        SY2[syncService\nConflict resolution · Queue]
        ST2[storageService\nFile / image uploads]
        LG[loggerService\nStructured logging]
    end

    subgraph Models["Data Models"]
        UM[User]
        PM[Pet]
        MRM[MedicalRecord]
        APM[Appointment]
        MDM[Medication]
        URM[UserRole]
    end

    subgraph Cache["Cache Layer"]
        CM[cacheManager\nIn-memory TTL cache]
    end

    AI --> Services
    EH --> Services
    Services --> Models
    Services --> CM
```

---

## 4. Project Directory Structure

```
PetChain-MobileApp/
├── src/                          # Frontend (React Native)
│   ├── config/                   # Environment config (dev/staging/prod)
│   ├── models/                   # Frontend data models
│   ├── screens/                  # UI screens
│   │   ├── OnboardingScreen.tsx  # App introduction carousel
│   │   ├── QRScannerScreen.tsx   # Camera-based QR scanner
│   │   ├── ManualEntryScreen.tsx # Fallback manual ID entry
│   │   └── EmergencyContactsScreen.tsx  # SOS + nearby clinics
│   ├── services/                 # Business logic & API calls
│   │   ├── apiClient.ts          # Axios instance + JWT interceptors
│   │   ├── authService.ts        # Login, register, token refresh
│   │   ├── petService.ts         # Pet CRUD + QR lookup
│   │   ├── medicalRecordService.ts
│   │   ├── appointmentService.ts
│   │   ├── medicationService.ts
│   │   ├── syncService.ts        # Offline queue + conflict resolution
│   │   ├── blockchainService.ts  # Stellar integration
│   │   ├── emergencyService.ts   # SOS + geolocation
│   │   ├── notificationService.ts
│   │   └── qrCodeService.ts
│   └── utils/
│       ├── encryption/           # Crypto utilities + keychain
│       ├── networkMonitor.ts     # Connectivity detection
│       └── validators.ts
│
└── backend/                      # Backend (Node.js / Express)
    ├── config/                   # Server configuration
    ├── middleware/
    │   ├── apiInterceptors.ts    # Request/response middleware
    │   └── errorHandler.ts       # Centralised error handling
    ├── models/                   # Shared data models / types
    │   ├── User.ts · UserRole.ts
    │   ├── Pet.ts
    │   ├── MedicalRecord.ts
    │   ├── Appointment.ts
    │   └── Medication.ts
    ├── services/                 # Server-side business logic
    │   ├── authService.ts
    │   ├── petService.ts
    │   ├── appointmentService.ts
    │   ├── medicationService.ts
    │   ├── syncService.ts
    │   ├── storageService.ts
    │   └── loggerService.ts
    ├── src/services/
    │   └── cacheManager.ts       # In-memory TTL cache
    ├── types/
    │   └── api.ts                # Shared API request/response types
    └── utils/
        ├── dateUtils.ts
        └── validators.ts
```

---

## Key Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Blockchain | Stellar | Immutable, tamper-proof medical record anchoring |
| Token storage | Keychain (iOS) / SecureStore (Android) | Device-locked secure storage, not AsyncStorage |
| Offline strategy | Queue-based sync with conflict resolution | Reliable offline-first UX |
| Conflict resolution | Last-write-wins (default) + manual override | Simple default, escape hatch for edge cases |
| QR integrity | CryptoJS checksum | Lightweight tamper detection without full blockchain lookup |
| Auth | JWT + refresh tokens + OAuth | Stateless, supports social login |
| API client | Axios with interceptors | Centralised auth injection and 401 retry logic |
