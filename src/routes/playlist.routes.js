import { Router } from "express";
import {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  updatePlaylist,
  deletePlaylist,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  updatePlaylistVisibility,
  getPlaylistsByVisibility,
  likeDislikePlaylist,
  sharePlaylist,
} from "../controllers/playlist.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJWT); // Apply authentication to all routes

// 🎵 Playlist CRUD
router.route("/").post(createPlaylist);

router
  .route("/:playlistId")
  .get(getPlaylistById)
  .patch(updatePlaylist)
  .delete(deletePlaylist);

// 🎬 Video Management in Playlist
router.route("/add/:videoId/:playlistId").patch(addVideoToPlaylist);
router.route("/remove/:videoId/:playlistId").patch(removeVideoFromPlaylist);

// 🔒 Visibility
router.route("/visibility/:visibility").get(getPlaylistsByVisibility);
router.route("/visibility/:playlistId").patch(updatePlaylistVisibility);

// ❤️ Like/Dislike
router.route("/:playlistId/like").patch(likeDislikePlaylist);

// 🔗 Share
router.route("/:playlistId/share").post(sharePlaylist);

// 🎧 User Playlists
router.route("/user/:userId").get(getUserPlaylists);

export default router;
