import Foundation
import XCTest
@testable import MadrasadzCore

/// «Continue with Google / Apple» (owner, 5 Nov 2026).
final class SocialSignInTests: XCTestCase {
    private func decode<T: Decodable>(_ type: T.Type, _ json: String) throws -> T {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try XCTUnwrap(decoder.decode(IOSAPI.Envelope<T>.self, from: Data(json.utf8)).data)
    }

    private let levels: [Signup.Level] = {
        let json = #"[{"id":"l3","name":"الثالثة ثانوي","secondary":true},{"id":"m4","name":"الرابعة متوسط"}]"#
        return try! JSONDecoder().decode([Signup.Level].self, from: Data(json.utf8))
    }()

    func testTheGoogleSheetCallbackIsReadStrictly() {
        XCTAssertEqual(SocialSignIn.parse(callback: URL(string: "madrasadz-auth://oauth?ticket=abc123")!), .ticket("abc123"))
        XCTAssertEqual(
            SocialSignIn.parse(callback: URL(string: "madrasadz-auth://oauth?signup=tok&name=%D9%85%D8%AD%D9%85%D8%AF&email=a%40gmail.com")!),
            .signup(SocialSignIn.PendingSignup(token: "tok", fullName: "محمد", email: "a@gmail.com"))
        )
        XCTAssertEqual(SocialSignIn.parse(callback: URL(string: "madrasadz-auth://oauth?error=OAUTH_PASSWORD_ONLY")!), .failure("OAUTH_PASSWORD_ONLY"))
        XCTAssertNil(SocialSignIn.parse(callback: URL(string: "https://madrasadz.com/oauth?ticket=abc")!), "another scheme")
        XCTAssertNil(SocialSignIn.parse(callback: URL(string: "madrasadz-auth://elsewhere?ticket=abc")!), "another host")
        XCTAssertNil(SocialSignIn.parse(callback: URL(string: "madrasadz-auth://oauth?ticket=")!), "empty value")
    }

    func testServerRepliesGiveASessionOrAnAccountToComplete() throws {
        let signedIn = try decode(SocialSignIn.Reply.self, #"{"ok":true,"data":{"status":"signed_in","token":"t1","expiresAt":"2030-01-01T00:00:00Z","role":"STUDENT"}}"#)
        XCTAssertEqual(signedIn.token, "t1")
        XCTAssertNil(signedIn.pending)
        let pending = try decode(SocialSignIn.Reply.self, #"{"ok":true,"data":{"status":"needs_profile","signupToken":"s1","fullName":null,"email":null}}"#)
        XCTAssertEqual(pending.pending, SocialSignIn.PendingSignup(token: "s1", fullName: nil, email: nil))
    }

    func testCapabilitiesWithoutSignInHideTheButtons() throws {
        let old = try decode(SocialSignIn.Capabilities.self, #"{"ok":true,"data":{"apiVersion":1,"features":["home"],"minAppBuild":1}}"#)
        XCTAssertNil(old.signIn)
        let on = try decode(SocialSignIn.Capabilities.self, #"{"ok":true,"data":{"apiVersion":1,"signIn":{"google":true,"apple":false}}}"#)
        XCTAssertEqual(on.signIn, SocialSignIn.Options(google: true, apple: false))
    }

    func testCompletingAnAccountNeedsNoEmailAndNoPassword() {
        var form = Signup.Form()
        form.fullName = "محمد الأمين"
        XCTAssertEqual(form.firstInvalidProfileField(levels: levels), .phone)
        form.phone = "0551 23 45 67"
        form.guardianPhone = "+213661234567"
        form.wilayaID = "w28"
        form.levelID = "l3"
        XCTAssertEqual(form.firstInvalidProfileField(levels: levels), .streamId)
        form.streamID = "s-lit"
        XCTAssertNil(form.firstInvalidProfileField(levels: levels))
        XCTAssertNotNil(form.firstInvalidField(levels: levels), "the e-mail form still needs e-mail and password")
        let payload = form.profilePayload(levels: levels, signupToken: "tok")
        XCTAssertEqual(payload, SocialSignIn.ProfilePayload(signupToken: "tok", fullName: "محمد الأمين", phone: "0551234567", guardianPhone: "0661234567", wilayaId: "w28", levelId: "l3", streamId: "s-lit"))
        form.levelID = "m4"
        XCTAssertNil(form.profilePayload(levels: levels, signupToken: "tok").streamId, "no stream below secondary")
    }
}
