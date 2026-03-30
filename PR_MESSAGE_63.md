## Title
feat: build typed pet service layer for Pet API calls (#63)

## Summary
Implements the mobile-side pet service layer in `src/services/petService.ts` for all required pet API operations against the PetChain NestJS backend.

## What Was Added
- Created `src/services/petService.ts` with typed service functions:
  - `getAllPets()`
  - `getPetById(petId)`
  - `getPetByQRCode(qrCode)`
  - `createPet(data)`
  - `updatePet(petId, data)`
  - `deletePet(petId)`
- Added centralized, typed API error mapping via `PetServiceError`.
- Ensured all functions return typed Promise responses.
- Implemented QR lookup behavior for scan data:
  - Primary lookup via pet QR endpoint.
  - Fallback: parse scanner payload/deep link and resolve by pet ID when needed.
- Uses shared API client (no raw Axios request calls for service operations).

## Test Coverage
- Added unit tests in `src/services/__tests__/petService.test.ts` covering:
  - CRUD request behavior
  - typed response unwrapping
  - QR lookup and fallback behavior
  - API error surfacing as `PetServiceError`
  - input validation for required identifiers

## Acceptance Criteria Check
- [x] All CRUD functions are implemented and typed
- [x] `getPetByQRCode()` works with QR scan data
- [x] Errors from the API are handled and surfaced correctly
- [x] All functions return typed Promise responses
- [x] Uses the shared API client (not raw Axios calls)

## Notes
- Implementation was added in `src/` (client layer) as requested.
- No backend/server-side implementation was introduced.
