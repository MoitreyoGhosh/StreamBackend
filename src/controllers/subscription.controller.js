import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  // TODO: toggle subscription
  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel ID format");
  }

  const channel = await User.findById(channelId);
  if (!channel) {
    throw new ApiError(404, "Channel not found");
  }

  const subscription = await Subscription.findOne({
    channel: channelId,
    subscriber: req.user._id,
  });

  if (subscription) {
    await Subscription.findByIdAndDelete(subscription._id);
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { subscribed: false },
          "Channel unsubscribed successfully"
        )
      );
  } else {
    const newSubscription = await Subscription.create({
      channel: channelId,
      subscriber: req.user._id,
    });

    if (!newSubscription) {
      throw new ApiError(500, "Failed to subscribe to channel");
    }

    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          { subscribed: true, subscription: newSubscription },
          "Channel subscribed successfully"
        )
      );
  }
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel ID format");
  }

  try {
    const channel = await User.findById(channelId);
    if (!channel) {
      throw new ApiError(404, "Channel not found");
    }

    const subscribers = await Subscription.aggregate([
      {
        $match: {
          channel: new mongoose.Types.ObjectId(channelId),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "subscriber",
          foreignField: "_id",
          as: "subscriberInfo",
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
        $unwind: "$subscriberInfo",
      },
      {
        $project: {
          _id: 0,
          subscriberInfo: 1,
        },
      },
    ]);

    if (!subscribers || subscribers.length === 0) {
      return res
        .status(200)
        .json(
          new ApiResponse(200, [], "No subscribers found for this channel")
        );
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { subscribers },
          "Subscribers fetched successfully"
        )
      );
  } catch (error) {
    console.error("Error getting channel subscribers:", error);
    throw new ApiError(500, "Failed to get channel subscribers", error);
  }
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;

  if (!isValidObjectId(subscriberId)) {
    throw new ApiError(400, "Invalid subscriber ID format");
  }

  try {
    const subscriber = await User.findById(subscriberId);
    if (!subscriber) {
      throw new ApiError(404, "Subscriber not found");
    }

    const subscribedChannels = await Subscription.aggregate([
      {
        $match: {
          subscriber: new mongoose.Types.ObjectId(subscriberId),
        },
      },
      {
        $lookup: {
          from: "users", // Name of the users collection (for channels)
          localField: "channel",
          foreignField: "_id",
          as: "channelInfo",
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
        $unwind: "$channelInfo", // Unwind the channelInfo array
      },
      {
        $project: {
          _id: 0, // Exclude the subscription _id
          channelInfo: 1, // Include channel information
        },
      },
    ]);

    if (!subscribedChannels || subscribedChannels.length === 0) {
      return res
        .status(200)
        .json(
          new ApiResponse(200, [], "No channels found for this subscriber")
        );
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { subscribedChannels },
          "Subscribed channels fetched successfully"
        )
      );
  } catch (error) {
    console.error("Error getting subscribed channels:", error);
    throw new ApiError(500, "Failed to get subscribed channels", error);
  }
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
