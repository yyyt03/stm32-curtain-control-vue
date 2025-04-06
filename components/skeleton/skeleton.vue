<template>
    <view class="skeleton" v-if="loading">
        <view class="skeleton-card" v-for="i in 4" :key="i">
            <view class="skeleton-title"></view>
            <view class="skeleton-content"></view>
        </view>
    </view>
</template>

<style>
.skeleton {
    padding: 30rpx;
}
.skeleton-card {
    height: 200rpx;
    background: #f5f5f5;
    margin-bottom: 20rpx;
    border-radius: 30rpx;
    animation: skeleton-loading 1.5s infinite;
}
@keyframes skeleton-loading {
    0% { opacity: 0.6; }
    50% { opacity: 0.8; }
    100% { opacity: 0.6; }
}
</style>