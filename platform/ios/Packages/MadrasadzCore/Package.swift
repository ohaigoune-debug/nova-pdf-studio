// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MadrasadzCore",
    platforms: [.iOS(.v17), .macOS(.v13)],
    products: [.library(name: "MadrasadzCore", targets: ["MadrasadzCore"])],
    targets: [
        .target(name: "MadrasadzCore"),
        .testTarget(name: "MadrasadzCoreTests", dependencies: ["MadrasadzCore"])
    ]
)
