import { describe, expect, it } from 'vitest'
import { encodeS3Path, signV4 } from '@/server/lib/storage-s3'

/**
 * متجه اختبار رسمي من وثائق AWS (Signature Version 4 — GET Object):
 * https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-examples-using-sdks.html
 */
describe('توقيع S3 SigV4', () => {
  it('يطابق مثال AWS الرسمي (GET Object مع Range)', () => {
    const r = signV4({
      method: 'GET',
      host: 'examplebucket.s3.amazonaws.com',
      path: '/test.txt',
      headers: { range: 'bytes=0-9' },
      payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      date: new Date('2013-05-24T00:00:00Z'),
      region: 'us-east-1',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
    })
    expect(r.amzDate).toBe('20130524T000000Z')
    expect(r.signedHeaders).toBe('host;range;x-amz-content-sha256;x-amz-date')
    expect(r.authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41'
    )
  })

  it('يطابق مثال AWS الرسمي (PUT Object)', () => {
    const r = signV4({
      method: 'PUT',
      host: 'examplebucket.s3.amazonaws.com',
      path: '/test%24file.text',
      headers: { date: 'Fri, 24 May 2013 00:00:00 GMT', 'x-amz-storage-class': 'REDUCED_REDUNDANCY' },
      payloadHash: '44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072',
      date: new Date('2013-05-24T00:00:00Z'),
      region: 'us-east-1',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
    })
    expect(r.authorization.endsWith('Signature=98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd')).toBe(true)
  })

  it('ترميز المسار يحافظ على / ويرمّز المقاطع', () => {
    expect(encodeS3Path('ws/2026-09/ab cd.csv')).toBe('ws/2026-09/ab%20cd.csv')
    expect(encodeS3Path("a'b(c)*")).toBe("a%27b%28c%29%2A")
  })
})
