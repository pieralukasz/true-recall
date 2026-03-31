import { ParameterOptimizerService } from "./optimizer/parameter-optimizer.service";
import { EasyDaysService, } from "./scheduler/easy-days.service";
import { FlattenService } from "./scheduler/flatten.service";
import { LoadBalanceService } from "./scheduler/load-balance.service";
import { PostponeAdvanceService } from "./scheduler/postpone-advance.service";
import { RescheduleService } from "./scheduler/reschedule.service";
import { ScheduleBreakService } from "./scheduler/schedule-break.service";
import { SiblingDisperseService } from "./scheduler/sibling-disperse.service";
import { DistributionCalculator, } from "./statistics/distribution.calculator";
import { TrueRetentionCalculator, } from "./statistics/true-retention.calculator";
import { WorkloadForecastCalculator, } from "./statistics/workload-forecast.calculator";
export class FSRSHelperService {
    constructor(cardStore, settings) {
        this.cardStore = cardStore;
        this.settings = settings;
        this.optimizer = new ParameterOptimizerService();
        this.loadBalancer = new LoadBalanceService(cardStore);
        this.easyDays = new EasyDaysService(cardStore);
        this.postponeAdvance = new PostponeAdvanceService(cardStore);
        this.flatten = new FlattenService(cardStore);
        this.siblingDisperse = new SiblingDisperseService(cardStore);
        this.scheduleBreak = new ScheduleBreakService(cardStore);
        this.reschedule = new RescheduleService(cardStore, this.extractFSRSSettings());
        this.trueRetention = new TrueRetentionCalculator(cardStore);
        this.workloadForecast = new WorkloadForecastCalculator(cardStore);
        this.distribution = new DistributionCalculator(cardStore);
    }
    updateSettings(settings) {
        this.settings = settings;
        this.reschedule = new RescheduleService(this.cardStore, this.extractFSRSSettings());
    }
    optimizeParameters(options, presetName, currentWeights) {
        var _a;
        const reviews = this.cardStore.getReviewDataForOptimization(presetName);
        const input = {
            reviews,
            currentWeights: (_a = currentWeights !== null && currentWeights !== void 0 ? currentWeights : this.settings.fsrsWeights) !== null && _a !== void 0 ? _a : undefined,
            minReviews: 400,
        };
        return this.optimizer.optimize(input, options);
    }
    validateWeights(weights) {
        return this.optimizer.validateWeights(weights);
    }
    balanceWorkload(options) {
        var _a, _b, _c, _d, _e, _f;
        return this.loadBalancer.balance({
            targetPerDay: (_a = options === null || options === void 0 ? void 0 : options.targetPerDay) !== null && _a !== void 0 ? _a : this.settings.loadBalanceTarget,
            maxDeviation: (_b = options === null || options === void 0 ? void 0 : options.maxDeviation) !== null && _b !== void 0 ? _b : this.settings.loadBalanceMaxDeviation,
            days: (_c = options === null || options === void 0 ? void 0 : options.days) !== null && _c !== void 0 ? _c : 30,
            easyDays: (_d = options === null || options === void 0 ? void 0 : options.easyDays) !== null && _d !== void 0 ? _d : this.settings.easyDays,
            easyDaysMultiplier: (_e = options === null || options === void 0 ? void 0 : options.easyDaysMultiplier) !== null && _e !== void 0 ? _e : this.settings.easyDaysMultiplier,
            dryRun: (_f = options === null || options === void 0 ? void 0 : options.dryRun) !== null && _f !== void 0 ? _f : true,
        });
    }
    getWorkloadDistribution(days = 30) {
        return this.loadBalancer.getDistribution(days);
    }
    applyEasyDays(options) {
        var _a, _b, _c, _d, _e;
        return this.easyDays.applyEasyDays({
            easyDays: (_a = options === null || options === void 0 ? void 0 : options.easyDays) !== null && _a !== void 0 ? _a : this.settings.easyDays,
            multiplier: (_b = options === null || options === void 0 ? void 0 : options.multiplier) !== null && _b !== void 0 ? _b : this.settings.easyDaysMultiplier,
            targetPerDay: (_c = options === null || options === void 0 ? void 0 : options.targetPerDay) !== null && _c !== void 0 ? _c : this.settings.loadBalanceTarget,
            days: (_d = options === null || options === void 0 ? void 0 : options.days) !== null && _d !== void 0 ? _d : 30,
            dryRun: (_e = options === null || options === void 0 ? void 0 : options.dryRun) !== null && _e !== void 0 ? _e : true,
        });
    }
    previewEasyDays() {
        return this.easyDays.previewImpact(this.settings.easyDays, this.settings.easyDaysMultiplier, this.settings.loadBalanceTarget);
    }
    shiftDueDates(options) {
        return this.postponeAdvance.shift(options);
    }
    flattenDate(options) {
        return this.flatten.flatten(options);
    }
    findOverloadedDays(maxCards, days = 30) {
        return this.flatten.findOverloadedDays(maxCards, days);
    }
    disperseSiblings(options) {
        var _a, _b;
        return this.siblingDisperse.disperse({
            minInterval: (_a = options === null || options === void 0 ? void 0 : options.minInterval) !== null && _a !== void 0 ? _a : this.settings.siblingMinInterval,
            sourceUid: options === null || options === void 0 ? void 0 : options.sourceUid,
            dryRun: (_b = options === null || options === void 0 ? void 0 : options.dryRun) !== null && _b !== void 0 ? _b : true,
        });
    }
    findSiblingViolations() {
        return this.siblingDisperse.findViolations(this.settings.siblingMinInterval);
    }
    scheduleBreakPeriod(options) {
        return this.scheduleBreak.scheduleBreak(options);
    }
    previewBreak(startDate, endDate) {
        return this.scheduleBreak.previewBreak(startDate, endDate);
    }
    rescheduleCards(options) {
        return this.reschedule.reschedule(options);
    }
    getTrueRetentionSummary(days = 30, presetNames) {
        return this.trueRetention.getSummary(this.settings.fsrsRequestRetention, days, presetNames);
    }
    getTrueRetentionSnapshot(days = 30, presetNames) {
        return this.trueRetention.getSummaryAndRolling(this.settings.fsrsRequestRetention, days, 7, presetNames);
    }
    getTrueRetentionHistory(days = 30, presetNames) {
        return this.trueRetention.getRollingAverage(days, 7, presetNames);
    }
    getWorkloadForecast(days = 30) {
        return this.workloadForecast.getForecast(days);
    }
    getWorkloadForecastSummary(days = 30) {
        return this.workloadForecast.getSummary(this.settings.loadBalanceTarget, days);
    }
    getWorkloadByDayOfWeek(days = 30) {
        return this.workloadForecast.getWorkloadByDayOfWeek(days);
    }
    getDistributions() {
        return this.distribution.getAllDistributions();
    }
    extractFSRSSettings() {
        return {
            requestRetention: this.settings.fsrsRequestRetention,
            maximumInterval: this.settings.fsrsMaximumInterval,
            weights: this.settings.fsrsWeights,
            learningSteps: this.settings.learningSteps,
            relearningSteps: this.settings.relearningSteps,
            enableShortTerm: true,
        };
    }
}
