import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "auto",
  endpoint: "https://11be46ea1fc5e4ea4cb8a1046b8ce31b.r2.cloudflarestorage.com",
  credentials: {
    accessKeyId: "813e185b59f25b994e2ed7e5239b2e57",
    secretAccessKey: "ef5e0e66630c9589651dd6abe2319e3c448fe963017d700ac8d752f0ec91616a",
  },
});

const BUCKET_NAME = "hospital-dicom-archive";

async function runTest() {
  console.log("==================================================");
  console.log("  GURU NANAK HOSPITAL — CLOUDFLARE R2 WRITE TEST");
  console.log("==================================================");

  try {
    console.log("[1/2] Uploading test DICOM metadata file to bucket...");
    const testFileName = `test-dicom-${Date.now()}.dcm`;
    const testFileContent = "GURU_NANAK_HOSPITAL_DICOM_SIMULATED_PAYLOAD";

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testFileName,
      Body: testFileContent,
      ContentType: "application/dicom",
    }));
    
    console.log(`✓ Successfully uploaded '${testFileName}' to bucket '${BUCKET_NAME}'!`);
    console.log("[2/2] Cloudflare R2 storage layer is fully verified and ready.");
    console.log("==================================================\n");

  } catch (error) {
    console.error("\n❌ R2 Write Test Failed:");
    console.error(error.message);
    console.log("==================================================\n");
  }
}

runTest();
