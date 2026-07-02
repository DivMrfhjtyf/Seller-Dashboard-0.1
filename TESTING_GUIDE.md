# 🧪 SYSTEM TESTING GUIDE

## Quick Start

```bash
# Install dependencies
npm install

# Install testing dependencies
npm install --save-dev jest supertest

# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test tests/routes.test.js
```

## Test Structure

```
tests/
├── setup.test.js              # System startup & health checks
├── auth.test.js               # Authentication & JWT
├── authorization.test.js      # RBAC & permissions
├── routes.test.js             # Route registration
└── frontend-routes.test.js    # Frontend navigation
```

## Manual Testing Checklist

### Backend Testing

#### 1. Server Startup
```bash
npm run dev
# Check:
# ✅ "Server running on http://localhost:3000"
# ✅ "MongoDB Connected"
# ✅ "Route loaded: /seller"
# ✅ "Route loaded: /admin"
# ✅ "Route loaded: /delivery"
```

#### 2. Health Check
```bash
curl http://localhost:3000/health
# Should return:
# {
#   "status": "OK",
#   "timestamp": "2026-07-02T...",
#   "uptime": 123.45
# }
```

#### 3. Authentication Testing
```bash
# Test seller login
curl -X POST http://localhost:3000/seller/signin \
  -d "email=seller@test.com" \
  -d "password=password123"

# Test admin login
curl -X POST http://localhost:3000/admin/login \
  -d "email=admin@test.com" \
  -d "password=admin123"
```

### Frontend Testing

#### 1. Seller Dashboard Routes
```
Test these URLs in browser:

✅ http://localhost:3000/seller/dashboard
✅ http://localhost:3000/seller/products
✅ http://localhost:3000/seller/products/add
✅ http://localhost:3000/seller/orders
✅ http://localhost:3000/seller/earnings
✅ http://localhost:3000/seller/settings

Expected:
- Pages should load without errors
- Navigation menu should work
- Logout button should function
```

#### 2. Admin Dashboard Routes
```
Test these URLs in browser:

✅ http://localhost:3000/admin/dashboard
✅ http://localhost:3000/admin/sellers
✅ http://localhost:3000/admin/orders
✅ http://localhost:3000/admin/delivery

Expected:
- Pages should load without errors
- Admin menu should work
- Action buttons should be visible
```

#### 3. Form Submissions
```
✅ Add Product Form
   - Fill form fields
   - Upload image
   - Submit
   - Should create product

✅ Approve Seller Form
   - Select seller
   - Click approve
   - Should show success message

✅ Update Order Status
   - Change status
   - Add note
   - Submit
   - Should update order
```

#### 4. Error Handling
```
✅ 404 Page
   - Visit http://localhost:3000/invalid-route
   - Should show 404 error page

✅ Unauthenticated Access
   - Clear cookies
   - Try to visit /seller/dashboard
   - Should redirect to login

✅ Permission Denied
   - Login as seller
   - Try to visit /admin/dashboard
   - Should show 403 or redirect
```

## API Endpoint Testing

### Using Postman or Curl

#### Seller Routes
```bash
# Get seller products
GET /seller/products?page=1

# Add new product
POST /seller/products
Content-Type: application/json
{
  "title": "Test Product",
  "price": 100,
  "description": "Test"
}

# Get seller orders
GET /seller/orders?page=1

# Update order status
PATCH /seller/orders/:id/status
{
  "status": "shipped"
}
```

#### Admin Routes
```bash
# Get all sellers
GET /admin/sellers?page=1

# Approve seller
POST /admin/sellers/:id/approve

# Get all orders
GET /admin/orders?page=1

# Update order status
PATCH /admin/orders/:id/status
{
  "status": "delivered",
  "note": "Order delivered"
}

# Process refund
POST /admin/orders/:id/refund
{
  "refundAmount": 100,
  "reason": "Customer request"
}
```

## Browser DevTools Testing

### Network Tab
- ✅ All API calls should return 200/201
- ✅ No 404 errors for static assets
- ✅ No console errors
- ✅ Cookies should be set with HttpOnly flag

### Console Tab
- ✅ No errors
- ✅ No warnings about CORS
- ✅ No undefined variables

### Storage Tab
- ✅ JWT token should be in cookies
- ✅ Session should be active
- ✅ No sensitive data in localStorage

## Performance Testing

```bash
# Install ab (Apache Bench)
brew install ab

# Test homepage (100 requests, 10 concurrent)
ab -n 100 -c 10 http://localhost:3000/

# Test API endpoint (1000 requests)
ab -n 1000 -c 50 http://localhost:3000/health
```

Expected:
- Response time < 200ms
- Failed requests = 0
- Requests/second > 50

## Known Issues & Workarounds

### Issue: Routes not loading
```
❌ Problem: Route skipped warnings in console
✅ Fix: Check route file exists
✅ Fix: Check syntax errors in route file
✅ Fix: Restart server
```

### Issue: Authentication not working
```
❌ Problem: Cannot login
✅ Fix: Check MongoDB is running
✅ Fix: Check JWT_SECRET in .env
✅ Fix: Check user exists in database
```

### Issue: Pages showing 404
```
❌ Problem: Routes return 404
✅ Fix: Verify routes are mounted in app.js
✅ Fix: Check route path is correct
✅ Fix: Check auth middleware is working
```

## Continuous Integration

### GitHub Actions Workflow
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm test
      - run: npm run test:coverage
```

## Reporting Issues

When reporting issues, include:
1. Screenshot of error
2. Console error message
3. Network tab error (if API issue)
4. Steps to reproduce
5. Expected vs actual behavior

---

**Last Updated:** 2026-07-02  
**Next Review:** 2026-07-09
