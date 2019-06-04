import { ItemLinkResolver, ItemPropertyResolver, ItemRichTextResolver } from '../../models/item/item-resolvers';
import { IContentItemDebugData } from './i-content-item-debug-data.interface';
import { IContentItemSystemAttributes } from './icontent-item-system-attributes.interface';

export interface IContentItem {

    /**
    * Indexer
    */
    [key: string]: any;

    /**
     * Content item system elements
     */
    system: IContentItemSystemAttributes;

    /**
     * Debug data of the item
     */
    debug: IContentItemDebugData;

    /**
    * Function used to bind fields returned from Kentico Cloud to a model property.
    * Common use is to bind e.g. 'FirstName' field from Kentico Cloud response to 'firstName' field in model
     */
    propertyResolver?: ItemPropertyResolver;

    /**
     * Function used to resolve links or URL slug fields
     */
    linkResolver?: ItemLinkResolver;

    /**
    * Function used to resolve linked items in rich text fields to HTML
    */
    richTextResolver?: ItemRichTextResolver;
}
