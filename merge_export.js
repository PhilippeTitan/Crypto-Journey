const fs = require('fs');
const path = require('path');

// Load both files
const sessionData = JSON.parse(fs.readFileSync(path.join('C:\\MAURINEX\\Crypto Journey', 'session_export.json'), 'utf-8'));
const thinkingData = JSON.parse(fs.readFileSync(path.join('C:\\MAURINEX\\Crypto Journey', 'thinking_export.json'), 'utf-8'));

// Create a merged timeline: interleave user messages, thinking, tool calls, and responses
// by timestamp from the raw transcript
const transcriptPath = path.join(
  'c:\\Users\\drato\\AppData\\Roaming\\Code\\User\\workspaceStorage',
  'fe7e244af82d23db5fd85b73f83eaf3c',
  'GitHub.copilot-chat',
  'transcripts',
  '08839f5b-ee56-4cda-8055-0f0a8e7bed74.jsonl'
);

const lines = fs.readFileSync(transcriptPath, 'utf-8').split('\n').filter(l => l.trim());
const timeline = [];

let currentTurnThinking = [];
let currentTurnTools = [];
let currentUserMessage = null;
let currentAssistantContent = null;

for (const line of lines) {
  try {
    const obj = JSON.parse(line);
    const ts = obj.timestamp;
    
    switch (obj.type) {
      case 'user.message':
        timeline.push({
          timestamp: ts,
          type: 'user_message',
          content: obj.data.content,
          attachments: obj.data.attachments || []
        });
        break;
        
      case 'assistant.message':
        if (obj.data.reasoningText) {
          timeline.push({
            timestamp: ts,
            type: 'thinking',
            content: obj.data.reasoningText,
            tools_planned: obj.data.toolRequests ? obj.data.toolRequests.map(t => ({ name: t.name, args: t.arguments ? t.arguments.substring(0, 200) : '' })) : []
          });
        }
        if (obj.data.content && obj.data.content.length > 0) {
          timeline.push({
            timestamp: ts,
            type: 'assistant_response',
            content: obj.data.content
          });
        }
        break;
        
      case 'tool.execution_start':
        timeline.push({
          timestamp: ts,
          type: 'tool_call',
          tool: obj.data.toolName,
          args_preview: obj.data.arguments ? JSON.stringify(obj.data.arguments).substring(0, 300) : ''
        });
        break;
        
      case 'tool.execution_complete':
        timeline.push({
          timestamp: ts,
          type: 'tool_result',
          tool: obj.data.toolCallId,
          success: obj.data.success
        });
        break;
        
      case 'session.start':
        timeline.push({
          timestamp: ts,
          type: 'session_start',
          version: obj.data.version,
          copilotVersion: obj.data.copilotVersion,
          vscodeVersion: obj.data.vscodeVersion
        });
        break;
    }
  } catch (e) {}
}

// Sort timeline by timestamp
timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

const comprehensive = {
  session_id: '08839f5b-ee56-4cda-8055-0f0a8e7bed74',
  exported_at: new Date().toISOString(),
  summary: {
    transcript_lines: lines.length,
    user_messages: sessionData.turns.length,
    thinking_entries: thinkingData.total_reasoning_entries,
    tool_calls: timeline.filter(t => t.type === 'tool_call').length,
    assistant_responses: timeline.filter(t => t.type === 'assistant_response').length,
    event_breakdown: thinkingData.event_type_breakdown
  },
  metadata: sessionData.metadata || {},
  phases: sessionData.phases,
  key_milestones: sessionData.key_milestones,
  tech_stack: sessionData.tech_stack,
  files_created: sessionData.files_created,
  timeline: timeline,
  turns_summary: sessionData.turns,
  thinking_process: thinkingData.thinking_process
};

const outPath = path.join('C:\\MAURINEX\\Crypto Journey', 'session_full_export.json');
fs.writeFileSync(outPath, JSON.stringify(comprehensive, null, 2), 'utf-8');

const fileSizeMB = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
console.log(`Comprehensive export saved: ${outPath}`);
console.log(`File size: ${fileSizeMB} MB`);
console.log(`Timeline entries: ${timeline.length}`);
console.log(`  User messages: ${timeline.filter(t => t.type === 'user_message').length}`);
console.log(`  Thinking: ${timeline.filter(t => t.type === 'thinking').length}`);
console.log(`  Tool calls: ${timeline.filter(t => t.type === 'tool_call').length}`);
console.log(`  Assistant responses: ${timeline.filter(t => t.type === 'assistant_response').length}`);
console.log(`  Tool results: ${timeline.filter(t => t.type === 'tool_result').length}`);
