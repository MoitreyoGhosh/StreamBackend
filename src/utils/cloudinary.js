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
    // console.log("File has been uploaded on Cloudinary", response.url);
    // console.log(response);
    fs.unlinkSync(localfilePath); //remove the locally saved temporary file from the server
    return response;
  } catch (error) {
    fs.unlinkSync(localfilePath); //remove the locally saved temporary file from the server as the upload operation got failed
    return null;
  }
};

const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  try {
    if (!publicId) {
      console.warn("No public ID provided for Cloudinary deletion.");
      return;
    }

    let result;

    if (resourceType === "video") {
      result = await cloudinary.uploader.destroy(publicId, {
        resource_type: "video",
      });
    } else {
      result = await cloudinary.uploader.destroy(publicId); // Defaults to image
    }

    console.log(
      "Cloudinary deletion result:",
      result,
      `for public ID: ${publicId}`
    );

    if (result.result !== "ok" && result.result !== "not found") {
      console.error(
        "Cloudinary deletion failed:",
        result,
        `for public ID: ${publicId}`
      );
    }
  } catch (error) {
    console.error(
      "Error deleting from Cloudinary:",
      error,
      `for public ID: ${publicId}`
    );
  }
};

export { uploadOnCloudinary, deleteFromCloudinary };
