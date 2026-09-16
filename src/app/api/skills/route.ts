/**
 * MaurEdge 3.0 — Skills API
 * 
 * Serves the skill library and execution results to the UI.
 * Shows what the agent's named behaviors are and their performance.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const skills: any = typeof __non_webpack_require__ !== 'undefined'
  ? __non_webpack_require__(path.join(process.cwd(), 'core/skills/executor'))
  : require(path.join(process.cwd(), 'core/skills/executor'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const memory: any = typeof __non_webpack_require__ !== 'undefined'
  ? __non_webpack_require__(path.join(process.cwd(), 'core/memory/store'))
  : require(path.join(process.cwd(), 'core/memory/store'));


/**
 * GET /api/skills — returns skill library + stats
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const skillId = url.searchParams.get('id');

    if (skillId) {
      const skill = skills.getSkill(skillId);
      if (!skill) {
        return NextResponse.json({
          success: false,
          error: `Unknown skill: ${skillId}`,
        }, { status: 404 });
      }

      const stats = memory.getSkillStats(skillId);
      return NextResponse.json({
        success: true,
        skill,
        stats,
      });
    }

    const library = skills.getSkillLibrarySnapshot();
    return NextResponse.json({
      success: true,
      ...library,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
