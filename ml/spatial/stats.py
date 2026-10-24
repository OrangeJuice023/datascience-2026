"""Permutation-based spatial statistics (numpy only).

All weights are dense binary n x n matrices with a zero diagonal, as built by
spatial.weights. Moran's I uses them row-standardised; Getis-Ord Gi* uses them
binary with the unit itself included. Every p-value comes from a permutation
null, never from a normal approximation.
"""

import numpy as np


def row_standardise(w: np.ndarray) -> np.ndarray:
    k = w.sum(axis=1, keepdims=True)
    return np.divide(w, k, out=np.zeros_like(w, dtype=float), where=k > 0)


def bh_fdr(p: np.ndarray) -> np.ndarray:
    """Benjamini-Hochberg q-values; NaN p-values stay NaN and are not counted."""
    p = np.asarray(p, dtype=float)
    q = np.full_like(p, np.nan)
    ok = ~np.isnan(p)
    m = int(ok.sum())
    if m == 0:
        return q
    order = np.argsort(p[ok])
    ranked = p[ok][order] * m / np.arange(1, m + 1)
    ranked = np.minimum.accumulate(ranked[::-1])[::-1]
    out = np.empty(m)
    out[order] = np.minimum(ranked, 1.0)
    q[ok] = out
    return q


def moran_global(x: np.ndarray, w: np.ndarray, perms: int, rng: np.random.Generator) -> tuple[float, float]:
    """Moran's I and its one-sided (clustering) permutation p-value."""
    z = x - x.mean()
    wr = row_standardise(w)
    n, s0, zz = len(z), wr.sum(), z @ z
    if zz == 0:
        return np.nan, np.nan
    i_obs = n / s0 * (z @ wr @ z) / zz
    zp = rng.permuted(np.broadcast_to(z, (perms, n)), axis=1)
    i_sim = n / s0 * ((zp @ wr) * zp).sum(axis=1) / zz
    return float(i_obs), float((np.sum(i_sim >= i_obs) + 1) / (perms + 1))


def _conditional_draws(n: int, kmax: int, perms: int, rng: np.random.Generator) -> np.ndarray:
    """(perms, kmax) indices into the n - 1 *other* units, without replacement.

    The same draws serve every unit (as in PySAL's conditional randomisation);
    unit i maps index j >= i to j + 1 so that it never samples itself.
    """
    return rng.random((perms, n - 1)).argsort(axis=1)[:, :kmax]


def local_stats(x: np.ndarray, w: np.ndarray, perms: int, rng: np.random.Generator) -> dict:
    """Local Moran (row-standardised) and Gi* (binary, self included), conditional permutation.

    Returns per unit: lisa (I_i), lag (mean of neighbours' x), p_lisa (folded,
    two-sided pseudo p as in PySAL), gi (Gi* z-value), p_gi (one-sided, high).
    Units without neighbours get NaN.
    """
    n = len(x)
    k = w.sum(axis=1).astype(int)
    z = x - x.mean()
    m2 = (z @ z) / n
    nb = [np.flatnonzero(w[i]) for i in range(n)]
    lag = np.array([z[j].mean() if len(j) else np.nan for j in nb])
    lisa = z / m2 * lag if m2 > 0 else np.full(n, np.nan)

    # Gi* with binary weights including i: Wi = S1i = k_i + 1.
    xbar, s = x.mean(), x.std()
    local_sum = np.array([x[i] + x[j].sum() for i, j in enumerate(nb)])
    wi = k + 1
    denom = s * np.sqrt((n * wi - wi ** 2) / (n - 1))
    gi = np.divide(local_sum - xbar * wi, denom, out=np.full(n, np.nan), where=(denom > 0) & (k > 0))

    p_lisa, p_gi = np.full(n, np.nan), np.full(n, np.nan)
    if k.max() > 0 and m2 > 0:
        draws = _conditional_draws(n, int(k.max()), perms, rng)
        for i in range(n):
            if k[i] == 0:
                continue
            idx = draws[:, :k[i]]
            sample = x[idx + (idx >= i)]
            sim_lag = sample.mean(axis=1) - x.mean()
            sim = z[i] / m2 * sim_lag
            larger = np.sum(sim >= lisa[i])
            larger = min(larger, perms - larger)
            p_lisa[i] = (larger + 1) / (perms + 1)
            sim_sum = x[i] + sample.sum(axis=1)
            p_gi[i] = (np.sum(sim_sum >= local_sum[i]) + 1) / (perms + 1)
    lag[k == 0] = np.nan
    lisa[k == 0] = np.nan
    return dict(lisa=lisa, lag=lag, p_lisa=p_lisa, gi=gi, p_gi=p_gi)


def knox(units: np.ndarray, times: np.ndarray, close_space: np.ndarray, max_dt: int,
         perms: int, rng: np.random.Generator, strata: np.ndarray | None = None) -> dict:
    """Knox space-time test on events (unit index, week index).

    X counts event pairs in different units that are spatial neighbours
    (close_space, symmetric boolean) and start within max_dt weeks. The null
    permutes event times across events, within strata (e.g. epi years) when
    given, keeping each unit's events in place.
    """
    a, b = np.triu_indices(len(units), k=1)
    near = close_space[units[a], units[b]] & (units[a] != units[b])
    a, b = a[near], b[near]
    x_obs = int(np.sum(np.abs(times[a] - times[b]) <= max_dt))
    groups = [np.arange(len(times))] if strata is None else [np.flatnonzero(strata == s) for s in np.unique(strata)]
    sims = np.empty(perms)
    t = times.copy()
    for r in range(perms):
        for g in groups:
            t[g] = rng.permutation(times[g])
        sims[r] = np.sum(np.abs(t[a] - t[b]) <= max_dt)
    expected = float(sims.mean())
    return dict(events=int(len(units)), space_close_pairs=int(len(a)), observed=x_obs,
                expected=expected, ratio=x_obs / expected if expected else np.nan,
                p=float((np.sum(sims >= x_obs) + 1) / (perms + 1)))
