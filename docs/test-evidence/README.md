# Test Evidence

Thu muc nay luu log terminal dung lam minh chung cho slide/bao cao.
Test that su van nam trong tung module:

- Backend: `backend/tests`
- Blockchain: `blockchain/test`

## Backend

```powershell
cd backend
npm test -- --runInBand
```

Output: `backend/jest-test.txt`

Ket qua hien tai:

- Test suites: 13 passed
- Tests: 148 passed

Coverage:

```powershell
cd backend
npm test -- --runInBand --coverage
```

Output: `backend/jest-coverage.txt`

Ket qua coverage tong the hien tai:

- Statements: 43.2%
- Branches: 25.18%
- Functions: 22.41%
- Lines: 45.09%

Luu y: coverage backend tinh tren toan bo backend, bao gom DAO/socket/controller
chua duoc test truc tiep, nen so tong the thap hon cac module da viet unit test.

## Blockchain

```powershell
cd blockchain
npx hardhat test test/Charity.test.js
```

Output: `blockchain/hardhat-charity-test.txt`

Ket qua hien tai:

- Charity.sol: 42 passing

Coverage:

```powershell
cd blockchain
npx hardhat coverage --testfiles test/Charity.test.js
```

Output: `blockchain/hardhat-charity-coverage.txt`

Ket qua coverage rieng `Charity.sol` hien tai:

- Statements: 98.48%
- Branches: 85.71%
- Functions: 91.67%
- Lines: 98.72%

## Blockchain Gas

```powershell
cd blockchain
npx hardhat run scripts/measure-charity-gas.js
```

Output: `blockchain/charity-gas-measurement.txt`

Gas cost duoc do tren Hardhat Network. Chi phi ETH trong log la uoc tinh voi
gas price gia dinh `3 gwei`.

## Frontend

```powershell
cd frontend
npm run build
```

Output: `frontend/build.txt`

Ket qua hien tai:

- Production build thanh cong
- Build co warning ve CSS order, lint va browserslist, nhung khong chan build
