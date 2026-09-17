#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  BESLENCE AI Turkish diet & activity tracker. Latest task: build Google Calendar-style
  daily timeline grid with meal-type-based colors ("Ara Öğün" instead of "Atıştırmalık"),
  macro icon+colored bars (tap to expand details, X button to delete), and a red "Şimdi"
  line for current time. Also: chatbot ("Asistanım") must ask up to 2 multiple-choice
  clarification questions when the entry is ambiguous, instead of silently guessing.

backend:
  - task: "Chatbot clarification questions (max 2 multi-choice)"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            Modified /api/ai/chatbot. On ambiguous input the LLM now returns
            {needs_clarification: true, questions: [{id, question, options:[..]}],
            draft: {...}}. The endpoint accepts a second call with `draft` and
            `clarification_answers: [{id, answer}]` to finalize the entry. The
            non-clarification path still persists the entry as before. Added a
            `meal_type` field (kahvalti|ogle|aksam|ara_ogun|aktivite|su|kahve|not|plan)
            inferred from entry_type/time and stored on the entry.
  - task: "Entry persistence with meal_type"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            Added meal_type to EntryIn model and chatbot persistence path.
            Existing /api/entries POST automatically passes it via model_dump().

frontend:
  - task: "TimelineGrid (Google Calendar style)"
    implemented: true
    working: true
    file: "frontend/src/components/TimelineGrid.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: |
            Hour rows 07:00-24:00, cards positioned at correct minutes.
            Each card colored by meal_type (premium pastel palette).
            Compact view: title + meal-type pill + colored macro mini-bars (no numbers).
            Tap card → DetailModal with all macro details + ranges + delete button.
            Small ✕ button on top-right of each card to delete (with confirm).
            Red "Şimdi" line + dot at current minute (today only). Verified visually.
  - task: "Calendar + Dashboard integration of TimelineGrid"
    implemented: true
    working: true
    file: "frontend/app/(tabs)/calendar.tsx, frontend/app/(tabs)/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: |
            Replaced TimelineBubble list with TimelineGrid in both Dashboard
            and Calendar screens. onDelete callback wired to api.deleteEntry,
            then reloads data. Verified visually with seeded entries.
  - task: "Chatbot UI clarification multi-choice"
    implemented: true
    working: "NA"
    file: "frontend/app/(tabs)/chatbot.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            When backend returns needs_clarification, chatbot shows the questions
            with chip-style multi-choice buttons. Once all questions answered,
            the chatbot re-posts to /api/ai/chatbot with draft+answers to commit.
            Echoes the user's choices as a user message for transparency.

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 5
  run_ui: false

test_plan:
  current_focus:
    - "Chatbot clarification questions (max 2 multi-choice)"
    - "Entry persistence with meal_type"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: |
        BUG FIX + BATCH — needs backend verification.

        Session: Bearer demo_session_grid_001 (user_id=user_demo_grid01)
        EMERGENT_LLM_KEY in backend/.env.

        Test the following backend changes:

        1) HEALTH-QUESTION FILTER (new):
           POST /api/ai/chatbot with `{"message":"insülin direncim var ne yapmalıyım?", "user_local_time":"2026-07-01T15:00:00+03:00"}`.
           Expected: response `{ ok: true, is_health_question: true, reply: "<Turkish neutral disclaimer>" }`.
           NO entry should be persisted in Mongo. Verify the entries collection for
           user_demo_grid01 does NOT gain a new record from this request (count
           before == count after).
           Additional variations to try (all should return is_health_question=true, no persist):
             • "kalp hastasıyım hangi diyet uygun"
             • "hangi vitamini almalıyım"

        2) FOOD/DRINK/WATER/ACTIVITY STILL PERSISTS (regression):
           POST /api/ai/chatbot with `{"message":"1 bardak su ekle", "user_local_time":"2026-07-01T15:00:00+03:00"}`.
           Expected: `{ ok: true, needs_clarification: false, entry: {...} }` with
           entry persisted and `entry.time == "15:00"` (Istanbul).

        3) SUGAR WARNING WORDING + THRESHOLD (25g):
           GET /api/report/daily?date=2026-06-30
           If the day's implicit added_sugar_g > 25, the returned warnings array
           must include an item with `id: "sugar"` and `text` starting with
           "Bugün yiyeceklerdeki doğal ve eklenen şeker toplamın" and containing
           "günde 25 g altını önerir".
           If not tripped: verify NO sugar warning present.

        4) BMH FORMULA REGRESSION (Mifflin-St Jeor × 1.20 constant):
           - POST /api/profile with a known body (age=30, sex=erkek, height_cm=180, weight_kg=80)
             and any goal. Verify the returned plan has
             `bmr_kcal = round(10*80 + 6.25*180 - 5*30 + 5) = 1780`
             and `maintenance_calories = round(1780 * 1.20) = 2136`.
           - Same profile but sex=kadın: `bmr_kcal = round(10*80 + 6.25*180 - 5*30 - 161) = 1614`.

        5) PATCH endpoints (regression from previous test iteration):
           Ensure PATCH /api/entries/{id}/time and PATCH /api/entries/{id}/amount
           still work as before.

        Do NOT test frontend UI (I will verify screenshots myself). Backend only.

        Reference files:
        - /app/backend/server.py CHATBOT_INSTRUCTIONS (health-filter section around L536-568)
        - /app/backend/server.py chatbot endpoint (health path handler around L680-705)
        - /app/backend/server.py sugar warning (around L1100-1115)
        - /app/backend/server.py calc_plan Mifflin-St Jeor (around L279-355)