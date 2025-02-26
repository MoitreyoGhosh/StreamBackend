import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createTweet = asyncHandler(async (req, res) => {
  //create tweet
  const { content } = req.body;

  if (!content || content.trim() === "") {
    throw new ApiError(400, "Missing content! Tweet content is required");
  }

  try {
    const tweet = await Tweet.create({
      content,
      owner: req.user._id,
    });

    if (!tweet) {
      throw new ApiError(500, "Failed to create tweet");
    }

    return res
      .status(201)
      .json(new ApiResponse(201, tweet, "Tweet created successfully"));
  } catch (error) {
    console.error("Error creating tweet:", error);
    throw new ApiError(500, "Failed to create tweet", error);
  }
});

const getUserTweets = asyncHandler(async (req, res) => {
  //get user tweets
  const { userId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user ID format");
  }

  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);

  if (isNaN(pageNumber) || pageNumber < 1) {
    throw new ApiError(400, "Invalid page number.");
  }

  if (isNaN(limitNumber) || limitNumber < 1 || limitNumber > 100) {
    throw new ApiError(400, "Invalid limit. Must be between 1 and 100.");
  }

  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const tweets = await Tweet.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "ownerInfo",
          pipeline: [
            {
              $project: {
                username: 1,
                fullname: 1,
                avatar: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$ownerInfo",
          preserveNullAndEmptyArrays: true, // In case owner is missing
        },
      },
      {
        $project: {
          content: 1,
          createdAt: 1,
          owner: 1,
          ownerInfo: 1,
          updatedAt: 1,
        },
      },
      {
        $skip: (pageNumber - 1) * limitNumber,
      },
      {
        $limit: limitNumber,
      },
    ]);

    const totalTweets = await Tweet.countDocuments({
      owner: userId,
    });

    if (!tweets?.length) {
      throw new ApiError(500, "No tweets found for this user");
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          tweets,
          totalTweets,
          page: pageNumber,
          limit: limitNumber,
        },
        "Tweets fetched successfully"
      )
    );
  } catch (error) {
    console.error("Error getting user tweets:", error);
    throw new ApiError(500, "Failed to get user tweets", error);
  }
});

const updateTweet = asyncHandler(async (req, res) => {
  //update tweet
  const { tweetId } = req.params;
  const { content } = req.body;

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweet ID format");
  }

  if (!content || content.trim() === "") {
    throw new ApiError(400, "Missing content! Tweet content is required");
  }

  try {
    const tweet = await Tweet.findById(tweetId);

    if (!tweet) {
      throw new ApiError(404, "Tweet not found");
    }

    if (tweet.owner.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "You are not authorized to update this tweet");
    }

    //update tweet
    const updateTweet = await Tweet.findByIdAndUpdate(
      tweetId,
      {
        $set: { content: content },
      },
      { new: true }
    );

    if (!updateTweet) {
      throw new ApiError(500, "Failed to update tweet");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, updateTweet, "Tweet updated successfully"));
  } catch (error) {
    console.error("Error updating tweet:", error);
    throw new ApiError(500, "Failed to update tweet", error);
  }
});

const deleteTweet = asyncHandler(async (req, res) => {
  //delete tweet
  const { tweetId } = req.params;

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweet ID format");
  }

  try {
    const tweet = await Tweet.findById(tweetId);

    if (!tweet) {
      throw new ApiError(404, "Tweet not found");
    }

    if (tweet.owner.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "You are not authorized to delete this tweet");
    }

    //delete tweet
    const deleteTweet = await Tweet.findByIdAndDelete(tweetId);

    if (!deleteTweet) {
      throw new ApiError(500, "Failed to delete tweet");
    }

    return res.status(200).json(new ApiResponse(200, {}, "Tweet deleted"));
  } catch (error) {
    console.error("Error deleting tweet:", error);
    throw new ApiError(500, "Failed to delete tweet", error);
  }
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };
