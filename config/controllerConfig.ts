export interface ParamDef {
    key: string;
    label: string;
    type: 'float' | 'int' | 'boolean' | 'string';
    defaultValue: any;
    min?: number;
    max?: number;
    step?: number;
    description?: string;
}

export const CACC_PARAMS: ParamDef[] = [
    { key: 's0', label: 'Min Spacing (s0)', type: 'float', defaultValue: 0.7, min: 0, max: 5, step: 0.1, description: 'Minimum spacing (meters)' },
    { key: 'h', label: 'Time Headway (h)', type: 'float', defaultValue: 0.3, min: 0, max: 2, step: 0.1, description: 'Time headway (seconds)' },
    { key: 'K_spacing', label: 'K Spacing', type: 'float', defaultValue: 0.3, min: 0, max: 2, step: 0.05, description: 'Spacing error gain' },
    { key: 'K_velocity', label: 'K Velocity', type: 'float', defaultValue: 0.05, min: 0, max: 1, step: 0.01, description: 'Velocity error gain' },
    { key: 'acc_to_throttle_gain', label: 'Acc->Throttle', type: 'float', defaultValue: 0.65, min: 0, max: 2, step: 0.05, description: 'Conversion gain from acceleration to throttle' },
    { key: 'max_throttle', label: 'Max Throttle', type: 'float', defaultValue: 0.25, min: 0, max: 1, step: 0.01, description: 'Maximum throttle output' },
    { key: 'alpha_filter', label: 'Alpha Filter', type: 'float', defaultValue: 0.3, min: 0, max: 1, step: 0.05, description: 'Low-pass filter coefficient (0-1)' },
    { key: 'ki_velocity', label: 'Ki Velocity', type: 'float', defaultValue: 0.1, min: 0, max: 1, step: 0.05, description: 'Velocity integral gain' },
    { key: 'blend_heading_deg', label: 'Blend Heading', type: 'float', defaultValue: 20.0, min: 0, max: 90, step: 1.0, description: 'Used for blended spacing mode' }
];

export const PID_PARAMS: ParamDef[] = [
    { key: 'kp', label: 'Kp', type: 'float', defaultValue: 0.24, min: 0, max: 2, step: 0.01 },
    { key: 'ki', label: 'Ki', type: 'float', defaultValue: 0.035, min: 0, max: 1, step: 0.005 },
    { key: 'kd', label: 'Kd', type: 'float', defaultValue: 0.0, min: 0, max: 1, step: 0.01 },
    { key: 'max_throttle', label: 'Max Throttle', type: 'float', defaultValue: 0.24, min: 0, max: 1, step: 0.01 },
    { key: 'min_throttle', label: 'Min Throttle', type: 'float', defaultValue: 0.02, min: 0, max: 1, step: 0.01 },
    { key: 'ei_max', label: 'Integral Limit', type: 'float', defaultValue: 1.0, min: 0, max: 5, step: 0.1 },
    { key: 'v_ref', label: 'Ref Velocity', type: 'float', defaultValue: 0.7, min: 0, max: 2, step: 0.1 }
];

export const SA_ACC_PARAMS: ParamDef[] = [
    { key: 'tau', label: 'Tau', type: 'float', defaultValue: 0.4, min: 0, max: 2, step: 0.1 },
    { key: 'h', label: 'Time Headway (h)', type: 'float', defaultValue: 0.5, min: 0, max: 2, step: 0.1 },
    { key: 'k1', label: 'k1', type: 'float', defaultValue: -0.8, min: -5, max: 5, step: 0.1 },
    { key: 'k2', label: 'k2', type: 'float', defaultValue: 2.5, min: -5, max: 5, step: 0.1 },
    { key: 'li', label: 'li', type: 'float', defaultValue: 5.0, min: 0, max: 10, step: 0.1 },
    { key: 'Li', label: 'Li', type: 'float', defaultValue: 8.0, min: 0, max: 20, step: 0.1 },
    { key: 'acc_to_throttle_gain', label: 'Acc->Throttle', type: 'float', defaultValue: 0.65, min: 0, max: 2, step: 0.05 },
    { key: 'max_throttle', label: 'Max Throttle', type: 'float', defaultValue: 0.3, min: 0, max: 1, step: 0.01 }
];

export const PURE_PURSUIT_PARAMS: ParamDef[] = [
    { key: 'lookahead_distance', label: 'Lookahead Dist', type: 'float', defaultValue: 0.2, min: 0.1, max: 3.0, step: 0.1 },
    { key: 'k_steering', label: 'K Steering', type: 'float', defaultValue: 0.4, min: 0, max: 2.0, step: 0.05 },
    { key: 'max_steering', label: 'Max Steering', type: 'float', defaultValue: 0.5, min: 0.1, max: 1.0, step: 0.05 },
    { key: 'adaptive_lookahead', label: 'Adaptive', type: 'boolean', defaultValue: true },
    { key: 'curvature_threshold', label: 'Curvature Thresh', type: 'float', defaultValue: 0.3, min: 0, max: 1.0, step: 0.05 },
    { key: 'turn_lookahead_offset', label: 'Turn Offset', type: 'float', defaultValue: 0.1, min: -1.0, max: 1.0, step: 0.05 },
    { key: 'turn_lookahead_gain', label: 'Turn L.Ah. Gain', type: 'float', defaultValue: 1.5, min: 0, max: 5.0, step: 0.1 }
];

export const PP_MAP_PARAMS: ParamDef[] = [
    { key: 'sample_ds', label: 'Sample DS', type: 'float', defaultValue: 0.02, min: 0.01, max: 0.5, step: 0.01 },
    { key: 'desired_speed', label: 'Desired Speed', type: 'float', defaultValue: 0.6, min: 0, max: 2.0, step: 0.05 },
    { key: 'min_speed', label: 'Min Speed', type: 'float', defaultValue: 0.4, min: 0, max: 2.0, step: 0.05 },
    { key: 'kappa_speed_gain', label: 'Kappa Gain', type: 'float', defaultValue: 1.0, min: 0, max: 5.0, step: 0.1 },
    { key: 'max_speed', label: 'Max Speed', type: 'float', defaultValue: 0.75, min: 0.1, max: 2.0, step: 0.05 },
    { key: 'hard_turn_kappa', label: 'Hard Turn Kappa', type: 'float', defaultValue: 0.60, min: 0, max: 2.0, step: 0.05 },
    { key: 'hard_turn_speed', label: 'Hard Turn Speed', type: 'float', defaultValue: 0.36, min: 0, max: 2.0, step: 0.05 },
    { key: 't_clip_min', label: 'L1 Clip Min', type: 'float', defaultValue: 0.4, min: 0, max: 2.0, step: 0.1 },
    { key: 't_clip_max', label: 'L1 Clip Max', type: 'float', defaultValue: 1.2, min: 0, max: 3.0, step: 0.1 },
    { key: 'm_l1', label: 'L1 Slope (m_l1)', type: 'float', defaultValue: 0.5, min: 0, max: 2.0, step: 0.05 },
    { key: 'q_l1', label: 'L1 Base (q_l1)', type: 'float', defaultValue: 0.2, min: 0, max: 1.0, step: 0.05 },
    { key: 'speed_lookahead', label: 'Speed L.Ah.', type: 'float', defaultValue: 0.2, min: 0, max: 1.0, step: 0.05 },
    { key: 'lat_err_coeff', label: 'Lat Err Coeff', type: 'float', defaultValue: 0.2, min: 0, max: 1.0, step: 0.05 }
];

export const STANLEY_PARAMS: ParamDef[] = [
    { key: 'k_e', label: 'K Error (k_e)', type: 'float', defaultValue: 0.7, min: 0, max: 5.0, step: 0.1 },
    { key: 'k_soft', label: 'K Soft', type: 'float', defaultValue: 1.0, min: 0, max: 2.0, step: 0.1 },
    { key: 'max_steering', label: 'Max Steering', type: 'float', defaultValue: 0.5, min: 0.1, max: 1.0, step: 0.05 }
];

export const CONTROLLER_SCHEMAS: Record<string, ParamDef[]> = {
    'cacc': CACC_PARAMS,
    'pid': PID_PARAMS,
    'sa_acc': SA_ACC_PARAMS,
    'pure_pursuit': PURE_PURSUIT_PARAMS,
    'pp_map': PP_MAP_PARAMS,
    'stanley': STANLEY_PARAMS,
};

/**
 * Build a schema of ParamDefs from a raw parameters object loaded from YAML.
 * Best effort type inference.
 */
export function buildSchemaFromParams(params: Record<string, any>): ParamDef[] {
    return Object.entries(params).map(([key, value]) => {
        let type: 'float' | 'int' | 'boolean' | 'string' = 'string';
        let step = undefined;
        let min = undefined;
        let max = undefined;

        if (typeof value === 'boolean') {
            type = 'boolean';
        } else if (typeof value === 'number') {
            if (Number.isInteger(value)) {
                type = 'int';
                step = 1;
            } else {
                type = 'float';
                step = 0.05;
            }
            // Add some sensible defaults for unknown numeric values
            min = value >= 0 ? 0 : -Math.abs(value * 2 + 1);
            max = value > 0 ? value * 3 + 1 : 10;
        }

        return {
            key,
            label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            type,
            defaultValue: value,
            min,
            max,
            step,
            description: `Dynamically loaded parameter: ${key}`
        };
    });
}

/**
 * Get schema for a controller, checking dynamic config first, falling back to hard-coded schemas.
 */
export function getSchema(controllerType: string, dynamicParams?: Record<string, Record<string, any>>): ParamDef[] {
    if (dynamicParams && dynamicParams[controllerType]) {
        return buildSchemaFromParams(dynamicParams[controllerType]);
    }
    return CONTROLLER_SCHEMAS[controllerType] || [];
}
