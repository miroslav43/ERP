# Media — status and how to publish the demo video

**No video exists yet.** Until it does, put the LinkedIn company page in the
**Media URLs** field: https://www.linkedin.com/company/144846087/ . Never put
a link there that does not show the product or the company. When the video
is published, it replaces the LinkedIn link (or goes first, if the field
takes several).

Files in this folder:

| File | What it is |
| --- | --- |
| `demo-video-script.md` | 90-second shot list, English voice-over, captions, and what must not be shown or said |
| `demo-video.en.srt` | English subtitles timed to the voice-over (21 cues), ready to upload with the video |

The product website (https://administrativo.ro, English overview at
https://administrativo.ro/en) already goes in the form's website field, so it
does not need repeating under Media URLs.

## Recording, in short

1. Follow `demo-video-script.md`, recording with the demo company only.
2. Record the desktop shots with any screen recorder: OBS Studio, the Xbox
   Game Bar on Windows, or QuickTime on macOS. Record the phone shots with
   Android's built-in screen recorder.
3. Record the voice-over separately, then edit the clips onto it with any
   editor (DaVinci Resolve, Clipchamp or CapCut). Export an MP4, 1080p.

## Publishing it unlisted on YouTube

"Unlisted" means anyone with the link can watch the video, but it does not
appear in search, on the channel page or in recommendations.

1. Go to https://studio.youtube.com and sign in with the company Google
   account. If it has no channel yet, YouTube asks you to create one; use
   the name "ADMINISTRATIVO".
2. Click **Create → Upload videos** and choose the MP4.
3. **Details**:
   - Title: `ADMINISTRATIVO — 90-second product demo`.
   - Description: the elevator pitch from `form-answers.md` §7 (short
     version), then `https://administrativo.ro`.
   - Audience: choose **"No, it's not made for kids"**.
4. Still under Details, open **Show more → Language and captions**. Set
   *Video language* to English. Then go to **Subtitles → Add language →
   English → Upload file → With timing**, and choose `demo-video.en.srt`.
5. Click **Next** through *Video elements* and *Checks* (nothing to add).
6. **Visibility**: choose **Unlisted**, then **Save**.
7. Copy the link that YouTube shows (`https://youtu.be/…`). Open it in a
   private window to check that it plays without signing in.
8. Paste the link into the **Media URLs** field, add it to the data room
   (Product section), and update `data-room/README.md` and
   `data-room/index.html`, where the video is still marked "to be uploaded".

To withdraw the video later: in YouTube Studio, go to **Content**, set the
video to **Private**, or delete it.

Alternative: a Loom recording (https://www.loom.com) with sharing set to
"Anyone with the link" works the same way. The free plan limits each
recording to 5 minutes, which is more than enough for 90 seconds.
