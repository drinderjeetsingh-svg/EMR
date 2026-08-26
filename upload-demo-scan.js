import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from 'fs';
import path from 'path';

const s3 = new S3Client({
  region: "auto",
  endpoint: "https://11be46ea1fc5e4ea4cb8a1046b8ce31b.r2.cloudflarestorage.com",
  credentials: {
    accessKeyId: "813e185b59f25b994e2ed7e5239b2e57",
    secretAccessKey: "ef5e0e66630c9589651dd6abe2319e3c448fe963017d700ac8d752f0ec91616a",
  },
});

const BUCKET_NAME = "hospital-dicom-archive";

async function uploadDemo() {
  console.log("[+] Uploading demo CT scan slice to Cloudflare R2...");
  const objectKey = "studies/DEMO-UHID-9999/CT_BRAIN_AXIAL_SLICE_01.dcm";
  
  // Creating a simulated binary DICOM buffer for testing
  const dummyBuffer = Buffer.from("DICM_SIMULATED_CT_SLICE_DATA_GNH_PALWAL", "utf-8");

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: objectKey,
    Body: dummyBuffer,
    ContentType: "application/dicom",
  }));

  console.log(`[✓] Demo DICOM file successfully uploaded to R2!`);
  console.log(`[✓] Object Key: ${objectKey}`);
}

uploadDemo();
