/**
 * Kilit: Anket dosya kapanışında (zorunlu değil); WhatsApp link; gönderilmeyenlere ofis uyarısı.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/surveys/surveys-closure.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const specDir = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(specDir, rel), 'utf8');

const service = read('surveys.service.ts');
const controller = read('surveys.controller.ts');
const dto = read('dto/create-campaign.dto.ts');
const claimFiles = read('../claim-files/claim-files.service.ts');
const emergency = read('../emergency/emergency-cases.service.ts');

describe('survey closure lock', () => {
  it('kampanya fatura olmadan dosya id ile açılır', () => {
    assert.match(dto, /claimFileId\?:/);
    assert.match(dto, /emergencyCaseId\?:/);
    assert.match(dto, /invoiceRequestId\?:/);
    assert.match(service, /createFromClaimFile/);
    assert.match(service, /ensureCampaignForClaimFile/);
  });

  it('kapanışta kampanya oluşur, WhatsApp API gönderimi yok', () => {
    assert.match(claimFiles, /ensureCampaignForClaimFile\(id\)/);
    assert.match(claimFiles, /ensureCampaignForClaimFile\(fileId\)/);
    assert.match(emergency, /ensureCampaignForEmergencyCase/);
    assert.match(service, /buildWhatsAppUrl/);
    assert.doesNotMatch(service, /sendWhatsAppMessage/);
    assert.doesNotMatch(service, /whatsapp\.send\(/);
    assert.doesNotMatch(claimFiles, /sendSurveyLink/);
  });

  it('gönderilmeyen kapalı dosyalar ofis sorumlusuna listelenir', () => {
    assert.match(controller, /@Get\('closure-unsent'\)/);
    assert.match(controller, /@Get\('claim-file\/:claimFileId'\)/);
    assert.match(controller, /@Post\('send-by-claim-file\/:claimFileId'\)/);
    assert.match(service, /listClosureUnsent/);
    assert.match(service, /assignedOfficeUserId: userId/);
    assert.match(service, /isClosedState: true/);
  });

  it('Memnun Değilim gönderiminde açıklama kuralı uygulanır', () => {
    assert.match(service, /surveyDissatisfiedCommentMissing/);
    assert.match(service, /SURVEY_DISSATISFIED_COMMENT_MESSAGE/);
  });

  it('tamamlanan anket dosyaya bağlanır; olumsuzda sorumlu açıklaması', () => {
    assert.match(service, /emergencyCase: \{ select:/);
    assert.match(service, /channel: campaign.emergencyCaseId \? 'acil' : 'hasar'/);
    assert.match(service, /saveOwnerExplanation/);
    assert.match(controller, /owner-explanation/);
  });

  it('statik route :id den önce tanımlanır', () => {
    const closureIdx = controller.indexOf("@Get('closure-unsent')");
    const idIdx = controller.indexOf("@Get(':id')");
    assert.ok(closureIdx >= 0 && idIdx > closureIdx);
  });
});
