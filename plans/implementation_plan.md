# Implementation Plan for Guided Tours and Keyboard Shortcuts

## Overview
This plan outlines the steps to implement guided tours and keyboard shortcuts for the Blackistone Medical Centre Electron application.

## Dependencies
- **Intro.js**: For guided tours (https://introjs.com/)
- **Electron**: Already in use
- **Existing codebase**: HTML, CSS, JS structure

## Implementation Steps

### 1. Install Dependencies
- Add intro.js to package.json
- Install via npm: `npm install intro.js`

### 2. Update HTML Structure
- Add intro.js CSS and JS to index.html
- Ensure tour targets have appropriate data attributes or classes

### 3. Implement Tour Logic
- Create tour configurations for each tour type (Dashboard, Patient Management, Appointments)
- Add tour initialization and start functions in renderer.js
- Implement tour completion tracking

### 4. Add UI Elements
- Add "Take Tour" buttons to relevant screens
- Add "Help & Learning Center" menu item
- Create shortcuts modal/panel

### 5. Keyboard Shortcuts Implementation
- Define shortcut mappings
- Add global event listeners in renderer.js
- Implement shortcut actions (navigation, actions)
- Add shortcuts help display

### 6. Tour Features
- Progress indicators
- Skip/resume functionality
- Completion tracking
- Accessibility support

### 7. Testing
- Test tours on different screens
- Verify shortcuts work across the app
- Test accessibility features

## File Changes Required

### package.json
- Add intro.js dependency

### src/index.html
- Include intro.js CSS and JS
- Add tour trigger buttons

### src/renderer.js
- Add tour initialization code
- Add keyboard shortcut handlers
- Add help center logic

### src/index.css
- Add styles for tour overlays
- Add styles for shortcuts modal

## Tour Configurations

### Dashboard Tour
- 6 steps covering main dashboard elements
- Focus on statistics cards and charts

### Patient Management Tour
- 5 steps for patient CRUD operations
- Search and filtering features

### Appointments Tour
- 4 steps for appointment management
- Scheduling and billing integration

## Keyboard Shortcuts
- Navigation shortcuts (Ctrl+1, Ctrl+2, etc. for screens)
- Action shortcuts (Ctrl+N for new, Ctrl+S for save)
- Help shortcut (F1)

## Timeline
- Day 1: Install dependencies and setup
- Day 2: Implement basic tour structure
- Day 3: Add tour content and UI elements
- Day 4: Implement keyboard shortcuts
- Day 5: Testing and refinements

## Success Criteria
- Tours guide users effectively through features
- Shortcuts improve navigation speed
- Accessible to all users
- No performance impact on app