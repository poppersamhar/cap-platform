"""特征编码 + K-Means 聚类

Step 2-3: 把 LLM 抽取的特征编码成数值向量，然后用 K-Means 聚类。
自动用 Silhouette Score 确定最优 K（3 或 4）。
"""

import logging
from typing import Any

import numpy as np

logger = logging.getLogger("cap.factory.cluster")

# ── 特征编码器 ──

# 每个分类特征的合法取值（用于 one-hot）
CATEGORY_DOMAINS = {
    "decision_style": ["理性对比型", "感性冲动型", "犹豫纠结型", "务实直接型", "未知"],
    "purchase_motivation": ["家庭需求驱动", "个人升级驱动", "商用驱动", "通勤刚需驱动", "社交面子驱动", "未知"],
    "powertrain_preference": ["纯电", "插混", "燃油", "不限", "未知"],
    "brand_affinity": ["国产品牌偏好", "合资品牌偏好", "不限", "未知"],
    "price_sensitivity": ["高", "中", "低", "未知"],
    "objection_type": ["续航焦虑", "价格抵触", "品牌信任", "配置不满", "服务担忧", "无明确异议", "未知"],
    "age_group": ["25岁以下", "25-30岁", "30-35岁", "35-40岁", "40-45岁", "45岁以上", "未知"],
    "family_structure": ["单身", "已婚无孩", "已婚有孩", "三代同住", "未知"],
    "budget_range": ["10万以下", "10-15万", "15-20万", "20-25万", "25-30万", "30万以上", "未知"],
}

# 价格敏感度的数值映射
PRICE_SENS_MAP = {"高": 1.0, "中": 0.5, "低": 0.0, "未知": 0.5}

# 预算范围的中位数值（万元）
BUDGET_MID = {
    "10万以下": 8, "10-15万": 12.5, "15-20万": 17.5, "20-25万": 22.5,
    "25-30万": 27.5, "30万以上": 35, "未知": 15,
}


def _one_hot(value: str, domain: list[str]) -> list[int]:
    """One-Hot 编码"""
    v = value.strip() if value else "未知"
    if v not in domain:
        v = "未知"
    return [1 if d == v else 0 for d in domain]


def _multi_hot(values: list[str], domain: set[str]) -> list[int]:
    """Multi-Hot 编码（关注点 TOP3 等）"""
    if not values:
        return [0] * len(domain)
    domain_list = sorted(domain)
    vec = []
    for d in domain_list:
        matched = any(d in v for v in values)
        vec.append(1 if matched else 0)
    return vec


# 关注点关键词池（用于 multi-hot）
CONCERN_KEYWORDS = {
    "续航", "空间", "价格", "配置", "品牌", "安全", "动力", "外观",
    "内饰", "智能", "智驾", "油耗", "电耗", "售后", "保养",
    "舒适", "静音", "操控", "质量", "优惠",
}


def encode_features(features_list: list[dict[str, Any]]) -> np.ndarray:
    """把特征列表编码成数值矩阵 (n_samples, n_features)"""
    vectors = []

    for feats in features_list:
        vec = []

        # 1. 核心关注点 Multi-Hot
        concerns = feats.get("core_concerns", [])
        if isinstance(concerns, str):
            concerns = [concerns]
        vec.extend(_multi_hot(concerns, CONCERN_KEYWORDS))

        # 2. 分类特征 One-Hot
        for key, domain in CATEGORY_DOMAINS.items():
            vec.extend(_one_hot(feats.get(key, "未知"), domain))

        # 3. 数值特征
        ps = PRICE_SENS_MAP.get(feats.get("price_sensitivity", "中"), 0.5)
        vec.append(ps)
        budget = BUDGET_MID.get(feats.get("budget_range", "未知"), 15)
        vec.append(budget / 30.0)  # 归一化到 0-1

        vectors.append(vec)

    X = np.array(vectors, dtype=np.float32)

    # 列标准化（零均值单位方差）
    means = X.mean(axis=0, keepdims=True)
    stds = X.std(axis=0, keepdims=True)
    stds[stds == 0] = 1.0  # 避免除零
    X = (X - means) / stds

    logger.info(f"特征编码完成: {X.shape[0]} 样本 × {X.shape[1]} 维度")
    return X


# ── K-Means 聚类 ──

def kmeans_cluster(X: np.ndarray, max_k: int = 5) -> tuple[int, np.ndarray, list[int]]:
    """K-Means 聚类，自动用 Silhouette Score 确定最优 K

    返回: (best_k, labels, silhouette_scores)
    """
    n_samples = X.shape[0]
    if n_samples < 10:
        # 样本太少，直接按年龄段简单分组
        logger.warning(f"样本太少 ({n_samples})，无法聚类，返回单簇")
        return 1, np.zeros(n_samples, dtype=int), [0.0]

    max_k = min(max_k, n_samples - 1)
    min_k = 2

    best_k = min_k
    best_labels = np.zeros(n_samples, dtype=int)
    best_score = -1.0
    scores = []

    for k in range(min_k, max_k + 1):
        labels = _kmeans(X, k)
        score = _silhouette_score(X, labels)
        scores.append(score)
        logger.info(f"  K={k}: Silhouette={score:.3f}")
        if score > best_score:
            best_score = score
            best_k = k
            best_labels = labels

    logger.info(f"最优 K={best_k}, Silhouette={best_score:.3f}")
    return best_k, best_labels, scores


def _kmeans(X: np.ndarray, k: int, max_iter: int = 100) -> np.ndarray:
    """简化版 K-Means"""
    n_samples, n_features = X.shape
    np.random.seed(42)

    # K-Means++ 初始化
    centers = _kmeans_plus_plus(X, k)
    labels = np.zeros(n_samples, dtype=int)

    for _ in range(max_iter):
        # 分配
        distances = np.zeros((n_samples, k))
        for i in range(k):
            distances[:, i] = np.sum((X - centers[i]) ** 2, axis=1)
        new_labels = np.argmin(distances, axis=1)

        if np.array_equal(new_labels, labels):
            break
        labels = new_labels

        # 更新中心
        for i in range(k):
            mask = labels == i
            if mask.sum() > 0:
                centers[i] = X[mask].mean(axis=0)

    return labels


def _kmeans_plus_plus(X: np.ndarray, k: int) -> np.ndarray:
    """K-Means++ 初始化"""
    n_samples, n_features = X.shape
    centers = np.zeros((k, n_features))

    # 第一个中心随机选
    idx = np.random.randint(0, n_samples)
    centers[0] = X[idx]

    for i in range(1, k):
        dists = np.zeros(n_samples)
        for j in range(n_samples):
            d = np.sum((X[j] - centers[:i]) ** 2, axis=1)
            dists[j] = d.min()
        dist_sum = dists.sum()
        if dist_sum == 0:
            # 所有点重合，随机选
            idx = np.random.randint(0, n_samples)
        else:
            probs = dists / dist_sum
            idx = np.random.choice(n_samples, p=probs)
        centers[i] = X[idx]

    return centers


def _silhouette_score(X: np.ndarray, labels: np.ndarray) -> float:
    """计算轮廓系数（简化版）"""
    n_samples = X.shape[0]
    if len(set(labels)) < 2:
        return 0.0

    scores = []
    for i in range(n_samples):
        label = labels[i]
        same_cluster = labels == label
        other_clusters = ~same_cluster

        if same_cluster.sum() <= 1:
            scores.append(0.0)
            continue

        # a: 到同簇的平均距离
        a = np.mean([np.linalg.norm(X[i] - X[j]) for j in range(n_samples) if j != i and labels[j] == label])

        # b: 到其他簇的最小平均距离
        b = float("inf")
        for other_label in set(labels):
            if other_label == label:
                continue
            mask = labels == other_label
            if mask.sum() == 0:
                continue
            avg_dist = np.mean([np.linalg.norm(X[i] - X[j]) for j in range(n_samples) if labels[j] == other_label])
            b = min(b, avg_dist)

        if b == float("inf"):
            scores.append(0.0)
            continue

        s = (b - a) / max(a, b)
        scores.append(s)

    return float(np.mean(scores))


def assign_clusters(records: list[dict], features_list: list[dict]) -> dict[int, list[dict]]:
    """主入口: 编码 → 聚类 → 返回 cluster_id -> records"""
    X = encode_features(features_list)
    k, labels, scores = kmeans_cluster(X, max_k=5)

    clusters: dict[int, list[dict]] = {}
    for idx, label in enumerate(labels):
        clusters.setdefault(int(label), []).append(records[idx])

    return clusters


def assign_clusters_with_features(records: list[dict], features_list: list[dict]) -> dict[int, dict]:
    """主入口: 编码 → 聚类 → 返回 cluster_id -> {records, features}

    返回结构: {cluster_id: {"records": [...], "features": [...]}, ...}
    """
    X = encode_features(features_list)
    k, labels, scores = kmeans_cluster(X, max_k=5)

    clusters: dict[int, dict] = {}
    for idx, label in enumerate(labels):
        cid = int(label)
        if cid not in clusters:
            clusters[cid] = {"records": [], "features": []}
        clusters[cid]["records"].append(records[idx])
        clusters[cid]["features"].append(features_list[idx])

    return clusters
