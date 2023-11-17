// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// For some reason exporting it directly from 'vscode-tas-client' doesn't work well in unit tests with sinon.
// export { getExperimentationService } from 'vscode-tas-client';
// Hence getting it using require...

import type * as tasClientTypes from 'vscode-tas-client';

// eslint-disable-next-line global-require
const tasClient = require('vscode-tas-client') as typeof tasClientTypes;

export const { getExperimentationService } = tasClient;
