# Demo Script — Legacy Code Modernizer

## Demo Flow (3-5 minutes)

### 1. Introduction (30 seconds)
"India's IT sector manages billions of lines of legacy code. Updating this using AI is promising but risky — LLMs hallucinate when code context is too large. Our tool solves this with **Context Optimization**."

### 2. Show the Input (30 seconds)
- Open the app at http://localhost:5173
- Show the clean, animated UI with particle background
- Toggle between GitHub URL and File Upload modes
- Drag and drop a sample Java project

### 3. Start Translation (1 minute)
- Click "Start Modernization"
- Point out the **Progress Stepper** showing each phase
- As parsing happens, show the **Dependency Graph** appearing
- Highlight: "We parse every function and build a call graph"

### 4. Key Technique: Context Optimization (1 minute)
- As translation begins, point to the **Translation Log**
- "Notice: leaf functions are translated FIRST — no dependencies needed"
- "Each caller includes its already-translated dependencies in the prompt"
- "Comment filtering strips boilerplate but keeps reasoning comments"
- Show a node turning green on the graph as it's translated

### 5. Validation & Output (30 seconds)
- Show compilation validation step
- If fix loop triggers, show automatic repair attempts
- When done, show the download panel with statistics
- Download the ZIP, open it to show translated Python code

### 6. Technical Highlights (30 seconds)
- "Uses Groq (free Llama 3.3 70B) with Gemini as automatic fallback"
- "requirements.txt is auto-generated from source dependencies"
- "Everything streams in real-time via WebSocket"

## Demo Button
If no backend is available, click the **"▶ Demo"** button to see a simulated pipeline run that demonstrates all UI features.
