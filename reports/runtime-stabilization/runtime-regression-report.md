## Test 1: GET /users/:id hydration doğrulaması
Status: FAIL
Evidence: /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test1-hydration-get-response.json | /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test1-playwright-stdout.txt
Notes: {"userId":"7fcf1daa-4710-4a73-9c3c-d924c7f3c63e","apiFields":{"firstName":"Tests","lastName":"Tetst","email":"a@a.com","roleCode":"field_staff","departmentMembershipCount":1,"responsibilityAssignmentCount":1},"ui":null}

## Test 2: insurance_company_user izolasyonu
Status: PASS
Evidence: /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test2-insurance-user-create-response.json | /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test2-insurance-scope-put.json | /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test2-insurance-user-get-response.json | /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test2-claim-files-own.json | /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test2-claim-files-other.json
Notes: {"allowedCompanyId":"fc996bc5-4bbc-4d95-8485-190218f979e6","blockedCompanyId":"81f842ab-0920-44c4-88fc-4f806a543f75","ownCount":null,"otherCount":null}

## Test 3: Nested create/update payload korunumu
Status: PASS
Evidence: /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test3-nested-create-response.json | /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test3-nested-after-create-get-response.json | /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test3-nested-update-response.json | /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test3-nested-after-update-get-response.json
Notes: {"userId":"f99cfe04-4af7-416d-bde9-38803331a021"}

## Test 4: Hidden payload temizliği (role switch regression)
Status: FAIL
Evidence: /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test4-role-switch-create-response.json | /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test4-screen-put.json | /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test4-role-switch-office-update-response.json | /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test4-screen-after-role-switch.json | /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test4-role-switch-user-get-response.json
Notes: {"userId":"8654e149-81c4-4a78-9e20-01ab6c6ac94d","staleScreens":["hasar_dosyalari","acil_yardim","operasyon","eksperler","musteriler","tedarikciler","raporlar","kullanicilar","harita"]}

## Test 5: isPrimary validasyon regresyonu
Status: FAIL
Evidence: /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test5-primary-create-response.json | /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test5-primary-get-response.json | /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test5-primary-missing-update-response.json | /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test5-db-query-stdout.txt
Notes: {"userId":"1bae9a7b-d689-4cfc-a04e-91ec9c3a57ef","currentPrimaryDepartmentId":"e931493f-9c43-4a63-92c9-67584d65c124","missingPrimaryStatus":200,"dbQueryExitCode":0}

## Test 6: JWT / permission regresyon testi
Status: PASS
Evidence: /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test6-jwt-admin.json | /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test6-jwt-invalid.json | /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test6-jwt-expired.json | /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test6-jwt-missing.json
Notes: {"admin":200,"invalid":401,"expired":401,"missing":401}

## Test 7: Expert 403 davranışı
Status: FAIL
Evidence: /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test7-expert-login.json | /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test7-expert-admin-endpoint.json | /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test7-expert-own-file.json | /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test7-expert-other-file.json
Notes: {"expertEmail":"info@safranbh.com","adminEndpointStatus":null,"ownFileStatus":null,"otherFileStatus":null}

## Test 8: claim_responsibility_assignments veri korunumu
Status: PASS
Evidence: /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test8-assignment-create-response.json | /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test8-assignment-initial-get-response.json | /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test8-assignment-name-update-response.json | /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test8-assignment-after-name-get-response.json | /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test8-db-query-stdout.txt
Notes: {"userId":"0992c9bd-9e11-4a5c-a243-e54d9d1a2c5c","dbExitCode":0}

## Test 9: Role switch sonrası stale state temizliği
Status: FAIL
Evidence: /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test9-stale-create-response.json | /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test9-stale-service-areas.json | /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test9-stale-screen-permissions.json | /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test9-stale-switch-update-response.json | /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test9-stale-after-switch-get-response.json | /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test9-stale-screen-after-switch.json
Notes: {"userId":"369fd073-2e2f-45b9-8a17-e6952799cb16","visibleStaleScreens":["hasar_dosyalari","acil_yardim","operasyon","eksperler","musteriler","tedarikciler","kullanicilar","harita"],"staleServiceAreaCount":0}

## Test 10: Create/Edit parity doğrulaması
Status: FAIL
Evidence: /Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/test10-playwright-stdout.txt
Notes: null
