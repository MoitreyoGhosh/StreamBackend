import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  //create playlist

  if (!name || !description) {
    throw new ApiError(400, "Name and description are required");
  }

  const existingPlaylist = await Playlist.findOne({
    name,
    owner: req.user?._id,
  });

  if (existingPlaylist) {
    throw new ApiError(400, "Playlist already exists");
  }

  const playlist = await Playlist.create({
    name,
    description,
    owner: req.user?._id,
  });

  if (!playlist) {
    throw new ApiError(500, "Failed to create playlist");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, playlist, "Playlist created successfully"));
});

const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  //get user playlists

  if (!userId || !isValidObjectId(userId)) {
    throw new ApiError(400, "No user ID or Invalid user ID format");
  }

  const userPlaylist = await Playlist.aggregate([
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
        as: "createdBy",
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
    { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videos",
        pipeline: [
          // further lookup to get the owner details of the video
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
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
          { $unwind: { path: "$owner", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              title: 1,
              description: 1,
              thumbnail: 1,
              owner: 1,
              duration: 1,
              views: 1,
              likes: 1,
              videoFile: 1,
              createdAt: 1,
              updatedAt: 1,
            },
          },
        ],
      },
    },
    {
      $project: {
        videos: 1,
        description: 1,
        name: 1,
        createdBy: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ]);

  if (!userPlaylist.length) {
    //if(!userPlaylist) which would always be truthy because aggregate() returns an array.
    return res.status(200).json(new ApiResponse(200, [], "No playlist found"));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, userPlaylist, "User playlists fetched"));
});

const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  //get playlist by id

  if (!playlistId || !isValidObjectId(playlistId)) {
    throw new ApiError(400, "No playlist ID or Invalid playlist ID format");
  }

  const playlist = await Playlist.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(playlistId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "createdBy",
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
        path: "$createdBy",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videos",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
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
          { $unwind: { path: "$owner", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              title: 1,
              description: 1,
              thumbnail: 1,
              owner: 1,
              duration: 1,
              views: 1,
              likes: 1,
              videoFile: 1,
              createdAt: 1,
              updatedAt: 1,
            },
          },
        ],
      },
    },
    {
      $project: {
        videos: 1,
        description: 1,
        name: 1,
        createdBy: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ]);

  if (!playlist.length || playlist.length === 0) {
    return res.status(200).json(new ApiResponse(200, [], "No playlist found"));
  }

  const playlistData = playlist[0];

  if (
    playlistData.visibility === "private" &&
    (!playlistData.createdBy ||
      !playlistData.createdBy._id.equals(req.user._id))
  ) {
    throw new ApiError(403, "Unauthorized Access");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, playlistData, "Playlist fetched"));
});

const getPlaylistsByVisibility = asyncHandler(async (req, res, next) => {
  //get playlist by visibility
  try {
    const { visibility } = req.query; // 'public' or 'unlisted'
    const userId = req.user ? req.user._id : null; // Authenticated user

    if (!visibility || !["public", "unlisted"].includes(visibility)) {
      throw new ApiError(400, "Invalid or missing visibility parameter");
    }

    const playlists = await Playlist.find({
      visibility,
      $or: [{ owner: userId }, { visibility: { $ne: "private" } }],
    })
      .populate({
        path: "owner",
        select: "username fullname avatar",
      })
      .populate({
        path: "videos",
        select: "title thumbnail duration views",
      });

    if (!playlists || playlists.length === 0) {
      return res
        .status(404)
        .json(new ApiResponse(404, [], "No playlists found"));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, playlists, "Playlists fetched"));
  } catch (error) {
    console.error("Error fetching playlists:", error.message);
    next(new ApiError(500, "Internal Server Error"));
  }
});

const updatePlaylistVisibility = asyncHandler(async (req, res) => {
  //change playlist visibility
  const { playlistId } = req.params;
  const { visibility } = req.body;

  if (!["public", "unlisted", "private"].includes(visibility)) {
    throw new ApiError(400, "Invalid visibility option");
  }

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (!playlist.owner.equals(req.user._id)) {
    throw new ApiError(403, "Unauthorized");
  }

  playlist.visibility = visibility;
  await playlist.save();

  return res
    .status(200)
    .json(new ApiResponse(200, playlist, "Visibility updated"));
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  //add video to playlist

  if (!playlistId || !isValidObjectId(playlistId)) {
    throw new ApiError(400, "No playlist ID or Invalid playlist ID format");
  }

  if (!videoId || !isValidObjectId(videoId)) {
    throw new ApiError(400, "No video ID or Invalid video ID format");
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (!playlist.owner.equals(req.user._id)) {
    throw new ApiError(403, "Unauthorized");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (playlist.videos.includes(videoId)) {
    throw new ApiError(400, "Video already exists in playlist");
  }

  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlistId,
    { $push: { videos: videoId } },
    { new: true }
  ).populate("videos");

  if (!updatedPlaylist) {
    throw new ApiError(500, "Failed to add video to playlist");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedPlaylist, "Video added to playlist"));
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  //remove video from playlist

  if (!playlistId || !isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid or missing playlist ID");
  }

  if (!videoId || !isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid or missing video ID");
  }

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new ApiError(404, "No such playlist found");
  }

  if (!playlist.owner.equals(req.user._id)) {
    throw new ApiError(
      403,
      "You are not allowed to remove video from this playlist"
    );
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (!playlist.videos.includes(videoId)) {
    throw new ApiError(400, "Video not found in playlist");
  }

  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlistId,
    { $pull: { videos: videoId } },
    { new: true }
  ).populate("videos");

  if (!updatedPlaylist) {
    throw new ApiError(500, "Failed to remove video from playlist");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedPlaylist, "Video removed from playlist"));
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  //delete playlist

  if (!playlistId || !isValidObjectId(playlistId)) {
    throw new ApiError(400, "Missing or Invalid playlist ID");
  }

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new ApiError(404, "No playlist found with this ID"); //changed status code
  }

  if (!playlist.owner.equals(req.user._id)) {
    throw new ApiError(403, "You are not allowed to delete this playlist"); //changed status code
  }

  const deletedPlaylist = await Playlist.findByIdAndDelete(playlistId);

  if (!deletedPlaylist) {
    throw new ApiError(500, "Failed to delete playlist");
  }

  return res.status(200).json(new ApiResponse(200, {}, "Playlist deleted"));
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description } = req.body;
  //update playlist
  if (!playlistId || !isValidObjectId(playlistId)) {
    throw new ApiError(400, "Missing or Invalid playlist ID");
  }

  if (!name && !description) {
    throw new ApiError(400, "Missing name or description");
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "No playlist found with this ID");
  }

  if (!playlist.owner.equals(req.user._id)) {
    throw new ApiError(403, "You are not allowed to update this playlist");
  }

  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      $set: {
        name: name,
        description: description,
      },
    },
    { new: true }
  ).populate("videos");

  if (!updatedPlaylist) {
    throw new ApiError(500, "Failed to update playlist");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedPlaylist, "Playlist updated"));
});

const likeDislikePlaylist = asyncHandler(async (req, res) => {
  //like or dislike playlist
  const { playlistId } = req.params;
  const userId = req.user._id;

  if (!playlistId || !isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid playlist ID");
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  // Check if user already liked the playlist
  const alreadyLiked = playlist.likes.includes(userId);

  if (alreadyLiked) {
    // Remove like
    playlist.likes = playlist.likes.filter(
      (id) => id.toString() !== userId.toString()
    );
    await playlist.save();
    return res
      .status(200)
      .json(new ApiResponse(200, playlist, "Playlist disliked"));
  } else {
    // Add like
    playlist.likes.push(userId);
    await playlist.save();
    return res
      .status(200)
      .json(new ApiResponse(200, playlist, "Playlist liked"));
  }
});

const sharePlaylist = asyncHandler(async (req, res) => {
  //share playlist
  const { playlistId } = req.params;

  if (!playlistId || !isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid playlist ID");
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (
    !playlist.visibility === "private" &&
    !playlist.createdBy.equals(req.user._id)
  ) {
    throw new ApiError(403, "You are not allowed to share this playlist");
  }

  //share link
  const shareLink = `${req.protocol}://${req.get("host")}/playlists/${playlistId}`; //This ensures that the generated link works dynamically across different environments (local/dev/prod)

  if (!shareLink) {
    throw new ApiError(500, "Failed to generate share link");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, shareLink, "Playlist shared"));
});

export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  getPlaylistsByVisibility,
  updatePlaylistVisibility,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
  likeDislikePlaylist,
  sharePlaylist,
};
