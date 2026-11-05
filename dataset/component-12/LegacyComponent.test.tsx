// @vitest-environment happy-dom

import { registerDatasetBehavior } from '../support/behavior-contracts';
import * as LegacyComponent from './LegacyComponent';
import * as ModernComponent from './ModernComponent';

registerDatasetBehavior('component-12', LegacyComponent, ModernComponent);
