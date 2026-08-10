import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import User from './models/User.js';
import Note from './models/Note.js';

/**
 * Real-time collaboration relay.
 *
 * Clients open a WebSocket, join a room for a note, broadcast their edits and
 * cursor, and hear about everyone else's. Presence + cursor traffic is tiny;
 * edits carry the serialized elements[] and every other client rebuilds from
 * it (last-writer-wins, consistent with the app's snapshot model).
 */

const rooms = new Map(); // noteId -> Map<ws, member>

/** Resolve the authenticated user from the handshake's httpOnly cookie. */
async function authenticate(request) {
  try {
    const cookies = cookie.parse(request.headers.cookie || '');
    const payload = jwt.verify(cookies.token, process.env.JWT_SECRET);
    return await User.findById(payload.id);
  } catch {
    return null;
  }
}

/** Verify the peer may join a note room (owner, or an enabled invite code). */
async function authorize(user, noteId, code) {
  const query = { _id: noteId };
  if (!code) {
    query.userId = user.id; // owner path
  } else {
    query['share.code'] = code;
    query['share.enabled'] = true;
  }
  return Note.findOne(query);
}

function broadcast(room, message, except) {
  if (!room) return;
  const payload = JSON.stringify(message);
  for (const [ws] of room) {
    if (ws !== except && ws.readyState === ws.OPEN) ws.send(payload);
  }
}

export function attachRealtime(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, request) => {
    // resolve auth lazily so the very first message (join) is never dropped:
    // the listener is attached synchronously, auth happens inside the handler
    const userPromise = authenticate(request);

    let noteId = null;
    let room = null;
    const member = { user: null, color: COLORS[Math.floor(Math.random() * COLORS.length)] };

    const leave = () => {
      if (!room) return;
      room.delete(ws);
      if (room.size === 0) rooms.delete(noteId);
      else broadcast(room, { type: 'presence', members: membersOf(room) });
      room = null;
      noteId = null;
    };

    const handleMessage = async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      switch (msg.type) {
        case 'join': {
          if (!msg.noteId || noteId) return;
          const user = await userPromise;
          if (!user) return ws.close(4401, 'Not authenticated');
          const note = await authorize(user, msg.noteId, msg.code);
          if (!note) return ws.close(4403, 'No access to this note');

          member.user = { id: user.id, name: user.name };
          member.color = COLORS[user.id.charCodeAt(0) % COLORS.length];
          noteId = msg.noteId;
          room = rooms.get(noteId) || new Map();
          rooms.set(noteId, room);
          room.set(ws, member);
          member.access = msg.access || (note.share?.code === msg.code ? note.share.role : 'editor');
          broadcast(room, { type: 'presence', members: membersOf(room) }, ws);
          break;
        }
        case 'edit': {
          if (!room || msg.noteId !== noteId) return;
          broadcast(room, { type: 'edit', noteId, elements: msg.elements, actor: member.user }, ws);
          break;
        }
        case 'cursor': {
          if (!room || msg.noteId !== noteId) return;
          broadcast(room, { type: 'cursor', noteId, x: msg.x, y: msg.y, user: member.user, color: member.color }, ws);
          break;
        }
        case 'leave':
          leave();
          break;
      }
    };

    ws.on('message', (raw) => {
      handleMessage(raw);
    });
    ws.on('close', leave);
    ws.on('error', leave);
  });

  return wss;
}

function membersOf(room) {
  return [...room.values()].map((m) => ({ ...m.user, color: m.color, access: m.access }));
}

const COLORS = ['#2563eb', '#0d9488', '#db2777', '#d97706', '#7c3aed', '#059669'];
