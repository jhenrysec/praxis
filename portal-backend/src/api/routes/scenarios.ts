import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { loadScenarios, getScenarioById } from '../../services/scenarios.js';
import { NotFoundError } from '../../utils/errors.js';
import { param } from '../../utils/request.js';

export const scenariosRouter = Router();

scenariosRouter.use(authenticate);

// ── GET / ────────────────────────────────────────────────────────────────────

scenariosRouter.get('/', (_req, res) => {
  const scenarios = loadScenarios();
  res.json({ scenarios });
});

// ── GET /:id ─────────────────────────────────────────────────────────────────

scenariosRouter.get('/:id', (req, res, next) => {
  try {
    const scenario = getScenarioById(param(req, 'id'));
    if (!scenario) throw new NotFoundError('Scenario not found');
    res.json({ scenario });
  } catch (err) {
    next(err);
  }
});
