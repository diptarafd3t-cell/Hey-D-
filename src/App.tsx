/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ApiKeyGate } from './components/ApiKeyGate';
import { HeyDAssistant } from './components/HeyDAssistant';

export default function App() {
  return (
    <ApiKeyGate>
      <HeyDAssistant />
    </ApiKeyGate>
  );
}

