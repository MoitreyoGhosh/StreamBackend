import { v2 as cloudinary } from "cloudinary";
import fs from "fs"; //file system node module

// Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localfilePath) => {
  try {
    if (!localfilePath) return null;
    // Upload file to Cloudinary
    const response = await cloudinary.uploader.upload(localfilePath, {
      resource_type: "auto",
    });
    //File has been uploaded successfully
    console.log("File has been uploaded on Cloudinary", response.url);
    console.log(response);
    return response;
  } catch (error) {
    fs.unlinkSync(localfilePath); //remove the locally saved temporary file from the server as the upload operation got failed
    return null;
  }
};

export { uploadOnCloudinary };
