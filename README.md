# 3D Survival Game

A web-based 3D survival game built with Three.js. Survive by gathering resources, managing your stats, and crafting items!

## Features

- **3D First-Person Controls** - WASD to move, mouse to look around
- **Survival Mechanics** - Manage health, hunger, and thirst
- **Resource Gathering** - Collect wood from trees and stone from rocks
- **Crafting System** - Craft useful items like axes, campfires, and shelters
- **Day/Night Cycle** - Experience dynamic lighting as time passes
- **Procedural Environment** - Explore a randomized terrain with trees and rocks

## How to Play

### Controls
- **W/A/S/D** - Move around
- **Mouse** - Look around
- **E** - Interact with objects (gather resources)
- **C** - Open crafting menu
- **Space** - Jump

### Objective
Survive as long as possible by:
1. Gathering resources (wood and stone)
2. Keeping your survival stats above 0
3. Crafting items to help you survive
4. Managing the day/night cycle

### Stats
- **Health** - Your life. If it reaches 0, game over!
- **Hunger** - Decreases over time. If it reaches 0, you lose health.
- **Thirst** - Decreases faster than hunger. If it reaches 0, you lose health.

### Crafting Recipes
- **Campfire** - 5 wood, 3 stone
- **Stone Axe** - 3 wood, 5 stone
- **Basic Shelter** - 10 wood, 5 stone
- **Water Bottle** - 2 stone

## Setup on GitHub Pages

1. **Create a new repository on GitHub**
   - Go to github.com and click "New repository"
   - Name it something like "3d-survival-game"
   - Make it public
   - Don't initialize with README (we already have one)

2. **Upload the files**
   - Upload `index.html`
   - Upload `style.css`
   - Upload `script.js`
   - Upload `README.md`

3. **Enable GitHub Pages**
   - Go to your repository settings
   - Scroll down to "Pages" section
   - Under "Source", select "main" branch
   - Click Save
   - Your game will be live at: `https://yourusername.github.io/3d-survival-game/`

## Local Testing

To test locally before uploading to GitHub:

1. Download all files to a folder
2. Open `index.html` in a modern web browser (Chrome, Firefox, Edge)
3. Click to start playing!

Note: Some browsers may require a local server for full functionality. You can use:
- Python: `python -m http.server 8000`
- Node.js: `npx http-server`

Then visit `http://localhost:8000`

## Browser Compatibility

Works best on:
- Chrome/Edge (latest versions)
- Firefox (latest versions)
- Safari (latest versions)

Requires WebGL support.

## Future Improvements

Some ideas for expanding the game:
- Add food items to restore hunger
- Add water sources to restore thirst
- Include enemies/wildlife
- Add different biomes
- Implement a save system
- Add more crafting recipes
- Create building mechanics
- Add weather effects

## Credits

Built with:
- [Three.js](https://threejs.org/) - 3D graphics library
- Vanilla JavaScript - Game logic
- HTML5/CSS3 - UI and styling

## License

Free to use and modify for personal and educational purposes.

---

Enjoy the game! If you survive more than 10 days, you're doing great! 🎮🌲
