import type {EventArg, NavigationContainerEventMap} from '@react-navigation/native';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {View} from 'react-native';
import type {TextStyle, ViewStyle} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import Button from '@components/Button';
import Icon from '@components/Icon';
import type {MenuItemWithLink} from '@components/MenuItemList';
import {usePersonalDetails} from '@components/OnyxProvider';
import PopoverMenu from '@components/PopoverMenu';
import type {PopoverMenuItem} from '@components/PopoverMenu';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import {useProductTrainingContext} from '@components/ProductTrainingContext';
import type {SearchQueryJSON} from '@components/Search/types';
import Text from '@components/Text';
import ThreeDotsMenu from '@components/ThreeDotsMenu';
import EducationalTooltip from '@components/Tooltip/EducationalTooltip';
import useDeleteSavedSearch from '@hooks/useDeleteSavedSearch';
import useLocalize from '@hooks/useLocalize';
import useSingleExecution from '@hooks/useSingleExecution';
import useStyledSafeAreaInsets from '@hooks/useStyledSafeAreaInsets';
import useStyleUtils from '@hooks/useStyleUtils';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
import {clearAllFilters, updateAdvancedFilters} from '@libs/actions/Search';
import {mergeCardListWithWorkspaceFeeds} from '@libs/CardUtils';
import getPlatform from '@libs/getPlatform';
import Navigation, {navigationRef} from '@libs/Navigation/Navigation';
import {getAllTaxRates} from '@libs/PolicyUtils';
import {buildFilterFormValuesFromQuery} from '@libs/SearchQueryUtils';
import {getOverflowMenu} from '@libs/SearchUIUtils';
import variables from '@styles/variables';
import * as Expensicons from '@src/components/Icon/Expensicons';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import SCREENS from '@src/SCREENS';
import type {SearchTypeMenuItem} from './SearchTypeMenu';

type SavedSearchMenuItem = MenuItemWithLink & {
    key: string;
    hash: string;
    query: string;
    styles: Array<ViewStyle | TextStyle>;
};

type SearchTypeMenuNarrowProps = {
    typeMenuItems: SearchTypeMenuItem[];
    activeItemIndex: number;
    queryJSON: SearchQueryJSON;
    title?: string;
    savedSearchesMenuItems: SavedSearchMenuItem[];
};

function SearchTypeMenuNarrow({typeMenuItems, activeItemIndex, queryJSON, title, savedSearchesMenuItems}: SearchTypeMenuNarrowProps) {
    const theme = useTheme();
    const styles = useThemeStyles();
    const StyleUtils = useStyleUtils();
    const {singleExecution} = useSingleExecution();
    const {windowHeight} = useWindowDimensions();
    const {translate} = useLocalize();
    const {hash, policyID} = queryJSON;
    const {showDeleteModal, DeleteConfirmModal} = useDeleteSavedSearch();
    const [currencyList = {}] = useOnyx(ONYXKEYS.CURRENCY_LIST);
    const [policyCategories] = useOnyx(ONYXKEYS.COLLECTION.POLICY_CATEGORIES);
    const [policyTagsLists] = useOnyx(ONYXKEYS.COLLECTION.POLICY_TAGS);
    const personalDetails = usePersonalDetails();
    const [reports = {}] = useOnyx(ONYXKEYS.COLLECTION.REPORT);
    const taxRates = getAllTaxRates();
    const [userCardList = {}] = useOnyx(ONYXKEYS.CARD_LIST);
    const [workspaceCardFeeds = {}] = useOnyx(ONYXKEYS.COLLECTION.WORKSPACE_CARDS_LIST);
    const allCards = useMemo(() => mergeCardListWithWorkspaceFeeds(workspaceCardFeeds, userCardList), [userCardList, workspaceCardFeeds]);
    const {unmodifiedPaddings} = useStyledSafeAreaInsets();

    const [isPopoverVisible, setIsPopoverVisible] = useState(false);
    const buttonRef = useRef<HTMLDivElement>(null);

    const platform = getPlatform();
    const isWebOrDesktop = platform === CONST.PLATFORM.WEB || platform === CONST.PLATFORM.DESKTOP;

    const openMenu = useCallback(() => setIsPopoverVisible(true), []);
    const closeMenu = useCallback(() => setIsPopoverVisible(false), []);

    const [isScreenFocused, setIsScreenFocused] = useState(false);

    useEffect(() => {
        const listener = (event: EventArg<'state', false, NavigationContainerEventMap['state']['data']>) => {
            if (Navigation.getRouteNameFromStateEvent(event) === SCREENS.SEARCH.ROOT) {
                setIsScreenFocused(true);
                return;
            }
            setIsScreenFocused(false);
        };
        navigationRef.addListener('state', listener);
        return () => navigationRef.removeListener('state', listener);
    }, []);

    const {renderProductTrainingTooltip, shouldShowProductTrainingTooltip, hideProductTrainingTooltip} = useProductTrainingContext(
        CONST.PRODUCT_TRAINING_TOOLTIP_NAMES.SEARCH_FILTER_BUTTON_TOOLTIP,
        isScreenFocused,
    );

    const onPress = () => {
        hideProductTrainingTooltip();
        const values = buildFilterFormValuesFromQuery(queryJSON, policyCategories, policyTagsLists, currencyList, personalDetails, allCards, reports, taxRates);
        updateAdvancedFilters(values);
        Navigation.navigate(ROUTES.SEARCH_ADVANCED_FILTERS);
    };

    const currentSavedSearch = savedSearchesMenuItems.find((item) => Number(item.hash) === hash);

    const popoverMenuItems = useMemo(() => {
        const items = typeMenuItems.map((item, index) => {
            const isSelected = title ? false : index === activeItemIndex;

            return {
                text: item.title,
                onSelected: singleExecution(() => {
                    clearAllFilters();
                    Navigation.navigate(item.getRoute(policyID));
                }),
                isSelected,
                icon: item.icon,
                iconFill: isSelected ? theme.iconSuccessFill : theme.icon,
                iconRight: Expensicons.Checkmark,
                shouldShowRightIcon: isSelected,
                success: isSelected,
                containerStyle: isSelected ? [{backgroundColor: theme.border}] : undefined,
                shouldCallAfterModalHide: true,
            };
        });

        if (title && !currentSavedSearch) {
            items.push({
                text: title,
                onSelected: closeMenu,
                isSelected: !currentSavedSearch,
                icon: Expensicons.Filters,
                iconFill: theme.iconSuccessFill,
                success: true,
                containerStyle: undefined,
                iconRight: Expensicons.Checkmark,
                shouldShowRightIcon: false,
                shouldCallAfterModalHide: true,
            });
        }

        return items;
    }, [typeMenuItems, title, activeItemIndex, singleExecution, theme, policyID, closeMenu, currentSavedSearch]);

    const {menuIcon, menuTitle} = useMemo(() => {
        if (title) {
            return {
                menuIcon: Expensicons.Filters,
                menuTitle: title,
            };
        }

        const item = activeItemIndex !== -1 ? popoverMenuItems.at(activeItemIndex) : undefined;
        return {
            menuIcon: item?.icon ?? Expensicons.Receipt,
            menuTitle: item?.text,
        };
    }, [activeItemIndex, popoverMenuItems, title]);

    const titleViewStyles = useMemo(() => (title ? {...styles.flex1, ...styles.justifyContentCenter} : {}), [title, styles]);

    const savedSearchItems = savedSearchesMenuItems.map((item) => ({
        text: item.title ?? '',
        styles: [styles.textSupporting],
        onSelected: item.onPress,
        icon: Expensicons.Bookmark,
        iconFill: currentSavedSearch?.hash === item.hash ? theme.iconSuccessFill : theme.icon,
        shouldShowRightComponent: true,
        rightComponent: (
            <ThreeDotsMenu
                menuItems={getOverflowMenu(item.title ?? '', Number(item.hash ?? ''), item.query ?? '', showDeleteModal, true, closeMenu)}
                anchorPosition={{horizontal: 0, vertical: 380}}
                anchorAlignment={{
                    horizontal: CONST.MODAL.ANCHOR_ORIGIN_HORIZONTAL.RIGHT,
                    vertical: CONST.MODAL.ANCHOR_ORIGIN_VERTICAL.TOP,
                }}
                disabled={item.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE}
            />
        ),
        isSelected: currentSavedSearch?.hash === item.hash,
        shouldCallAfterModalHide: true,
        pendingAction: item.pendingAction,
        disabled: item.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE,
    }));
    const allMenuItems = [];
    allMenuItems.push(...popoverMenuItems);

    if (savedSearchesMenuItems.length > 0) {
        allMenuItems.push({
            text: translate('search.savedSearchesMenuItemTitle'),
            styles: [styles.textSupporting],
            disabled: true,
        });
        allMenuItems.push(...savedSearchItems);
    }
    return (
        <View style={[styles.pb3, styles.flexRow, styles.alignItemsCenter, styles.justifyContentBetween, styles.ph5, styles.gap2]}>
            <PressableWithFeedback
                accessible
                accessibilityLabel={activeItemIndex !== -1 ? popoverMenuItems.at(activeItemIndex)?.text ?? '' : ''}
                ref={buttonRef}
                wrapperStyle={styles.flex1}
                onPress={openMenu}
            >
                {({hovered}) => (
                    <View style={[styles.tabSelectorButton, styles.tabBackground(hovered, true, theme.border), styles.w100, StyleUtils.getHeight(variables.componentSizeNormal)]}>
                        <View style={[styles.flexRow, styles.gap2, styles.alignItemsCenter, titleViewStyles]}>
                            <Icon
                                src={menuIcon}
                                fill={theme.icon}
                                small
                            />
                            <Text
                                numberOfLines={1}
                                style={[styles.textStrong, styles.flexShrink1, styles.textLineHeightNormal, styles.fontSizeLabel]}
                            >
                                {menuTitle}
                            </Text>
                            <Icon
                                src={Expensicons.DownArrow}
                                fill={theme.icon}
                                small
                            />
                        </View>
                    </View>
                )}
            </PressableWithFeedback>
            <EducationalTooltip
                shouldRender={shouldShowProductTrainingTooltip}
                anchorAlignment={{
                    horizontal: isWebOrDesktop ? CONST.MODAL.ANCHOR_ORIGIN_HORIZONTAL.CENTER : CONST.MODAL.ANCHOR_ORIGIN_HORIZONTAL.RIGHT,
                    vertical: CONST.MODAL.ANCHOR_ORIGIN_VERTICAL.TOP,
                }}
                shiftHorizontal={isWebOrDesktop ? 0 : variables.searchFiltersTooltipShiftHorizontalNarrow}
                shiftVertical={variables.searchFiltersTooltipShiftVerticalNarrow}
                wrapperStyle={styles.productTrainingTooltipWrapper}
                renderTooltipContent={renderProductTrainingTooltip}
                onTooltipPress={onPress}
            >
                <Button
                    icon={Expensicons.Filters}
                    onPress={onPress}
                />
            </EducationalTooltip>
            <PopoverMenu
                menuItems={allMenuItems as PopoverMenuItem[]}
                isVisible={isPopoverVisible}
                anchorPosition={styles.createMenuPositionSidebar(windowHeight)}
                onClose={closeMenu}
                onItemSelected={closeMenu}
                anchorRef={buttonRef}
                shouldUseScrollView
                shouldUseModalPaddingStyle={false}
                innerContainerStyle={{paddingBottom: unmodifiedPaddings.bottom}}
            />
            <DeleteConfirmModal />
        </View>
    );
}

SearchTypeMenuNarrow.displayName = 'SearchTypeMenuNarrow';

export default SearchTypeMenuNarrow;
