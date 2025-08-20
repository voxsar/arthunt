# Scavenger Hunt Model Setup

## Where to place your Teachable Machine model files:

Copy your exported Teachable Machine model files to:

```
e:\Projects\scavhunt\public\my_model\
```

## Required files:

- `model.json` - The model architecture
- `metadata.json` - Class labels and model info
- `weights.bin` - Model weights (or similar weight files)

## Steps to get your model files:

1. Go to [Teachable Machine](https://teachablemachine.withgoogle.com/)
2. Train your image model with the shapes you want to detect
3. Click "Export Model"
4. Choose "TensorFlow.js"
5. Click "Download my model"
6. Extract the downloaded files to the `public/my_model/` folder

## Supported shapes:

The app will automatically assign emojis to detected shapes:

- circle → ⭕
- square → ⬜
- triangle → 🔺
- star → ⭐
- heart → ❤️
- diamond → 💎
- Any other shape → 🔷

## Testing:

1. Place your model files in `public/my_model/`
2. Run `npm run dev`
3. Register with a valid phone number (format: 0774395913)
4. Point camera at objects to start detecting shapes!

The game requires finding 6 unique shapes to complete the scavenger hunt.
