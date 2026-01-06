# Plan: Add Image Field Support to Panda Bridge

## Project Review Summary

**Panda Bridge** is an Obsidian plugin that syncs flashcards to Anki. Key architecture:

- **Card Extraction**: Uses regex patterns to find `Q:` and `A:` labels in Markdown notes
- **Sync Logic**: Communicates with Anki via AnkiConnect HTTP API
- **Card Model**: Currently only supports Anki's Basic note type with `Front` and `Back` fields
- **Deck Management**: Supports note-based decks (mirrors folder structure) and deck overrides

### Core Components

1. **extractionUtils.ts**: Parses text to extract Q&A pairs
2. **CardExtractor.ts**: Manages extraction and DOM processing
3. **AnkiConnector.ts**: Handles all AnkiConnect API communication
4. **types.ts**: Defines data structures (AnkiCard, PandaBridgeSettings, etc.)

## Feature Proposal: I: Field for Images

### Goal
Allow users to specify an image field using `I:` syntax that will:
- Accept image file paths or links (jpg, png, gif, svg, webp)
- Handle both Obsidian internal links (`![[image.png]]`) and external URLs
- Sync images to Anki alongside Q&A pairs

### Complexity Assessment: **Medium** 🟡

**Why Medium Complexity:**

**Easy parts:**
- ✅ Adding `I:` field parsing to extraction logic (similar to Q/A extraction)
- ✅ Adding image field to settings (imageWord)
- ✅ Updating AnkiCard interface to include optional image field

**Medium parts:**
- 🟡 Reading image files from Obsidian vault filesystem
- 🟡 Converting images to base64 for AnkiConnect transmission
- 🟡 Using AnkiConnect's `storeMediaFile` API to send images
- 🟡 Updating card HTML to include `<img>` tags with correct Anki media references

**Challenges:**
- 🔴 Handling Obsidian-style image links `![[image.png]]` vs markdown `![](image.png)`
- 🔴 Resolving relative paths to absolute vault paths
- 🔴 Handling external URLs (download or direct link?)
- 🔴 Managing image updates/deletions in Anki's media collection
- 🔴 Error handling for missing/invalid images

## Implementation Plan

### Phase 1: Data Structure Updates

**Files to modify:**
- `src/sync/types.ts`

**Changes:**
1. Add `image?: string` field to `AnkiCard` interface
2. Add `imageWord: string` to `PandaBridgeSettings` interface
3. Update `DEFAULT_SETTINGS` to include `imageWord: 'I'`

**Effort:** 15 minutes ⏱️

---

### Phase 2: Extraction Logic

**Files to modify:**
- `src/sync/extractionUtils.ts`

**Changes:**
1. Update `extractQACardsFromText` to detect `I:` patterns
2. Support formats:
   - Single line: `Q: question A: answer I: image.png`
   - Multi-line: `I:` on its own line before or after A:
   - Obsidian links: `I: ![[image.png]]`
   - Markdown links: `I: ![](image.png)` or `I: image.png`
   - External URLs: `I: https://example.com/image.jpg`
3. Extract and normalize image paths/URLs
4. Handle edge cases (missing images, malformed paths)

**New utility functions needed:**
```typescript
function parseImagePath(imageLine: string): string | null
function isObsidianLink(path: string): boolean
function normalizeImagePath(path: string, notePath: string): string
```

**Effort:** 2-3 hours ⏱️

---

### Phase 3: Image File Handling

**New file to create:**
- `src/sync/imageUtils.ts`

**Functions needed:**
```typescript
/**
 * Reads image file from Obsidian vault
 * @param app Obsidian App instance
 * @param imagePath Resolved path to image
 * @returns Promise<ArrayBuffer> image data
 */
async function readImageFile(app: App, imagePath: string): Promise<ArrayBuffer>

/**
 * Converts image data to base64 string
 * @param data ArrayBuffer of image
 * @returns base64 encoded string
 */
function imageToBase64(data: ArrayBuffer): string

/**
 * Resolves relative image path to absolute vault path
 * @param app Obsidian App instance
 * @param imagePath Image path from card
 * @param notePath Path of the current note
 * @returns Resolved absolute path or null if not found
 */
async function resolveImagePath(
  app: App, 
  imagePath: string, 
  notePath: string
): Promise<string | null>

/**
 * Downloads external image URL to base64
 * @param url Image URL
 * @returns Promise<string> base64 data
 */
async function downloadImageToBase64(url: string): Promise<string>

/**
 * Extracts filename from path or URL
 * @param path Image path or URL
 * @returns filename with extension
 */
function getImageFilename(path: string): string
```

**Effort:** 3-4 hours ⏱️

---

### Phase 4: AnkiConnect Integration

**Files to modify:**
- `src/sync/AnkiConnector.ts`

**Changes:**

1. Add image handling to sync workflow:
   - Before creating/updating notes, upload images via `storeMediaFile`
   - Get Anki media filename from upload response
   - Update card HTML to reference uploaded image

2. New method:
```typescript
/**
 * Stores image file in Anki media collection
 * @param filename Name for the image file
 * @param base64Data Base64 encoded image data
 * @returns Promise<string> Anki media filename
 */
private async storeImageInAnki(
  filename: string, 
  base64Data: string
): Promise<string>
```

3. Update `syncCards` method:
   - Check if card has image field
   - If yes, upload image first
   - Include `<img src="filename">` in Back field or separate field

4. **Note Type Consideration:**
   - Current plugin uses Basic (Front/Back) model only
   - Two approaches:
     - **A) Append to Back field:** Add `<img src="file.jpg">` to answer text
     - **B) Use 3-field model:** Require "Basic + Image" note type with Front, Back, Image fields

   **Recommendation: Approach A initially** (simpler, works with existing Basic model)

5. Update card finding/comparison logic to handle images
   - Compare image fields when detecting updates
   - Handle image changes independently from text changes

**AnkiConnect API calls needed:**
- `storeMediaFile` - uploads image to Anki media folder
- `retrieveMediaFile` - (optional) for checking if image already exists
- `deleteMediaFile` - (optional) for cleaning up unused images

**Effort:** 4-5 hours ⏱️

---

### Phase 5: Settings UI

**Files to modify:**
- `src/dialogs/SettingsTab.ts`

**Changes:**
1. Add text input for `imageWord` (default: "I")
2. Add toggle for "Include images in cards" (enable/disable feature)
3. Add dropdown for image placement:
   - "Append to answer"
   - "Prepend to answer"
   - "Separate field" (future: if 3-field model support added)
4. Add help text explaining supported formats

**Effort:** 1-2 hours ⏱️

---

### Phase 6: Testing

**New test files:**
- `tests/imageExtraction.test.ts`
- `tests/imageUtils.test.ts`

**Test cases needed:**
1. Extract single-line cards with images
2. Extract multi-line cards with images
3. Handle Obsidian-style links `![[image.png]]`
4. Handle markdown-style links `![alt](image.png)`
5. Handle external URLs
6. Handle missing images gracefully
7. Handle invalid image paths
8. Test base64 conversion
9. Test AnkiConnect image upload
10. Test image in various positions (Q/A/I order variations)

**Update existing tests:**
- `tests/extraction.test.ts` - add image field cases

**Effort:** 3-4 hours ⏱️

---

### Phase 7: Documentation

**Files to update:**
1. `README.md`
   - Add image field to Quick Start example
   - Add image requirements to Requirements section
   - Update troubleshooting section

2. `docs/writing-cards.md`
   - Add section "Image fields"
   - Provide examples of all supported formats
   - Explain image resolution behavior
   - Note limitations (file size, formats, etc.)

3. `docs/settings.md`
   - Document new image-related settings

4. `CHANGELOG.md`
   - Add entry for image support feature

**Effort:** 1-2 hours ⏱️

---

### Phase 8: Edge Cases & Error Handling

**Scenarios to handle:**

1. **Missing images:**
   - Show warning notice
   - Continue syncing card without image
   - Log to console

2. **Invalid image formats:**
   - Validate extensions (jpg, jpeg, png, gif, svg, webp, bmp)
   - Reject unsupported formats with warning

3. **Large images:**
   - Consider adding size limit (e.g., 10MB)
   - Warn if image is too large
   - Optionally: auto-resize (future enhancement)

4. **External URLs:**
   - Handle network failures
   - Add timeout for downloads
   - Cache downloaded images (optional)

5. **Image updates:**
   - Detect when image path changes
   - Upload new image to Anki
   - Clean up old image (optional)

6. **Vault path resolution:**
   - Handle attachments folder settings
   - Support relative paths from note location
   - Support absolute paths from vault root

**Effort:** 2-3 hours ⏱️

---

## Total Estimated Effort

| Phase | Effort | Complexity |
|-------|--------|------------|
| 1. Data Structures | 15 min | Easy |
| 2. Extraction Logic | 2-3 hrs | Medium |
| 3. Image File Handling | 3-4 hrs | Medium |
| 4. AnkiConnect Integration | 4-5 hrs | Medium-Hard |
| 5. Settings UI | 1-2 hrs | Easy |
| 6. Testing | 3-4 hrs | Medium |
| 7. Documentation | 1-2 hrs | Easy |
| 8. Edge Cases | 2-3 hrs | Medium |
| **TOTAL** | **17-24 hours** | **Medium** |

---

## Implementation Order (Recommended)

1. ✅ **Phase 1**: Data structures (foundation)
2. ✅ **Phase 2**: Extraction logic (parse I: field)
3. ✅ **Phase 3**: Image file handling (read/convert images)
4. ✅ **Phase 4**: AnkiConnect integration (upload & sync)
5. ✅ **Phase 5**: Settings UI (user controls)
6. ✅ **Phase 8**: Edge cases (robust error handling)
7. ✅ **Phase 6**: Testing (validate everything works)
8. ✅ **Phase 7**: Documentation (user guide)

---

## Example Usage

### Single-line with image
```markdown
Q: What does a panda look like? A: Black and white bear I: panda.jpg
```

### Multi-line with Obsidian link
```markdown
Q: Identify this animal
A: This is a giant panda, native to China
I: ![[giant-panda.png]]
```

### With external URL
```markdown
Q: What is the Mona Lisa?
A: Famous painting by Leonardo da Vinci
I: https://example.com/monalisa.jpg
```

### Image before answer
```markdown
Q: What is this?
I: ![[microscope-image.png]]
A: Red blood cells under a microscope
```

---

## Technical Notes

### Obsidian API Usage
- Use `app.vault.adapter.read()` to read image files
- Use `app.metadataCache.getFirstLinkpathDest()` to resolve Obsidian links
- Handle both TFile and binary data appropriately

### AnkiConnect Image API
```json
{
  "action": "storeMediaFile",
  "version": 6,
  "params": {
    "filename": "image.jpg",
    "data": "base64encodeddata..."
  }
}
```

Returns the filename Anki assigned (may add prefix/suffix to avoid conflicts)

### HTML in Anki Cards
```html
Front: What does a panda look like?
Back: Black and white bear<br><img src="panda.jpg">
```

---

## Future Enhancements (Out of Scope for v1)

- [ ] Support for multiple images per card
- [ ] Image resizing/compression options
- [ ] Audio file support (similar to images)
- [ ] Support for custom note types with dedicated image fields
- [ ] Image gallery view in preview modal
- [ ] Automatic image cleanup (delete unused images from Anki)
- [ ] Image caching to avoid re-uploading unchanged images

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large images slow down sync | Medium | Add file size validation and warnings |
| External URLs fail to download | Medium | Graceful fallback, continue without image |
| Path resolution fails | Medium | Comprehensive error messages, fallback logic |
| AnkiConnect media upload fails | High | Retry logic, user notification |
| Breaking existing cards | High | Thorough testing, backwards compatibility |

---

## Success Criteria

- ✅ Users can add `I:` field to cards
- ✅ Images sync to Anki and display correctly
- ✅ Both local files and URLs are supported
- ✅ Obsidian-style links work seamlessly
- ✅ Error messages are clear and helpful
- ✅ Existing functionality remains unchanged
- ✅ Documentation is complete and accurate
- ✅ Tests cover all major scenarios

---

## Questions to Resolve

1. **Note Type:** Stay with Basic model (image in Back) or require new model?
   - **Recommendation:** Start with Basic, append image to Back field

2. **Image placement:** Where in the answer?
   - **Recommendation:** Make configurable (prepend/append)

3. **External URLs:** Download or hotlink?
   - **Recommendation:** Download and store in Anki (reliable offline access)

4. **Multiple images:** Support in v1?
   - **Recommendation:** No, single image per card for v1

5. **Image cleanup:** Delete orphaned images?
   - **Recommendation:** Manual cleanup in v1 (add to docs)

---

## Conclusion

Adding image support is **moderately complex** but **highly feasible**. The existing architecture is well-structured and can accommodate this feature with minimal refactoring. The main challenges are:

1. File handling and path resolution (Obsidian API complexity)
2. Base64 encoding and transmission (standard but needs care)
3. AnkiConnect integration (new API calls)
4. Comprehensive error handling (many failure modes)

**Estimated time: 17-24 hours of focused development work**

The feature would significantly enhance the plugin's utility for visual learning and make Panda Bridge more competitive with other Anki sync solutions.
