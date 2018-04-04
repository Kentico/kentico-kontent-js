import { DeliveryClientConfig } from '../config/delivery-client.config';
import { FieldDecorators } from '../fields/field-decorators';
import { FieldInterfaces } from '../fields/field-interfaces';
import { FieldType } from '../fields/field-type';
import { Fields } from '../fields/field-types';
import { IContentItem } from '../interfaces/item/icontent-item.interface';
import { IItemQueryConfig } from '../interfaces/item/iitem-query.config';
import { ILink } from '../interfaces/item/ilink.interface';
import { Link } from '../models/item/link.class';
import { IRichTextHtmlParser } from '../parser';
import { TypeResolverService } from './type-resolver.service';

export class FieldMapService {

    /**
     * Service used to resolve types
     */
    private readonly typeResolverService: TypeResolverService;

    constructor(
        private readonly config: DeliveryClientConfig,
        private readonly richTextHtmlParser: IRichTextHtmlParser
    ) {
        this.typeResolverService = new TypeResolverService(config);
    }

    /**
     * Maps all fields in given content item and returns strongly typed content item based on the resolver specified
     * in DeliveryClientConfig
     * @param item Item to map (raw response from Kentico Cloud)
     * @param modularContent Modular content sent along with item
     * @param queryConfig Query configuration
     */
    mapFields<TItem extends IContentItem>(item: IContentItem, modularContent: any, queryConfig: IItemQueryConfig, processedItems: IContentItem[]): TItem {
        if (!item) {
            throw Error(`Cannot map fields because item is not defined`);
        }

        if (!item.system) {
            throw Error(`Cannot map item because it does not contain system attributes. This is an essential field and every item should have one.`);
        }

        if (!item.elements) {
            throw Error(`Cannot map elements of item with codename '${item.system.codename}'`);
        }

        if (!processedItems) {
            throw Error(`ProcessedItems need to be initialized`);
        }

        if (!Array.isArray(processedItems)) {
            throw Error(`ProcessedItems need to be an array of 'IContentItems'`);
        }

        const properties = Object.getOwnPropertyNames(item.elements);

        let itemTyped: TItem;

        // check if resolver for this type is available
        if (this.typeResolverService.hasTypeResolver(item.system.type)) {
            itemTyped = this.typeResolverService.createTypedObj(item.system.type, item) as TItem;
        } else {
            itemTyped = this.typeResolverService.createContentItem(item) as TItem;
        }

        // add/taken item to processed items to avoid infinite recursion
        const processedItem = processedItems.find(m => m.system.codename === item.system.codename);
        if (!processedItem) {
            processedItems.push(itemTyped);
        }

        properties.forEach(fieldName => {
            const field = item.elements[fieldName] as FieldInterfaces.IField;
            let propertyName;

            // resolve field to a custom model property
            if (itemTyped.propertyResolver) {
                propertyName = itemTyped.propertyResolver(fieldName);
            }

            // if property hasn't been resolved, try with decorator
            if (!propertyName) {
                propertyName = FieldDecorators.getPropertyName(itemTyped, fieldName);
            }

            // if property name is null/empty, use elements codename
            if (!propertyName) {
                propertyName = fieldName;
            }
            itemTyped[propertyName] = this.mapField(field, modularContent, itemTyped, queryConfig, processedItems);
        });

        return itemTyped;
    }

    private mapField(field: FieldInterfaces.IField, modularContent: any, item: IContentItem, queryConfig: IItemQueryConfig, processedItems: IContentItem[]): any {
        if (field.type.toString() === FieldType.modular_content.toString()) {
            return this.mapModularField(field, modularContent, queryConfig, processedItems);
        } else if (field.type.toString() === FieldType.text.toString()) {
            return this.mapTextField(field);
        } else if (field.type.toString() === FieldType.asset.toString()) {
            return this.mapAssetsField(field);
        } else if (field.type.toString() === FieldType.number.toString()) {
            return this.mapNumberField(field);
        } else if (field.type.toString() === FieldType.multiple_choice.toString()) {
            return this.mapMultipleChoiceField(field);
        } else if (field.type.toString() === FieldType.datetime.toString()) {
            return this.mapDateTimeField(field);
        } else if (field.type.toString() === FieldType.rich_text.toString()) {
            return this.mapRichTextField(field as FieldInterfaces.IRichTextField, modularContent, queryConfig, processedItems);
        } else if (field.type.toString() === FieldType.url_slug.toString()) {
            return this.mapUrlSlugField(field, item, queryConfig);
        } else if (field.type.toString() === FieldType.taxonomy.toString()) {
            return this.mapTaxonomyField(field);
        } else {
            const err = `Unsupported field type '${field.type}'`
            if (this.config.enableAdvancedLogging) {
                console.warn(err, field);
            }
            throw Error(err)
        }
    }

    private mapRichTextField(field: FieldInterfaces.IRichTextField, modularContent: any, queryConfig: IItemQueryConfig, processedItems: IContentItem[]): Fields.RichTextField {
        // get all modular content items nested in rich text
        const modularItems: IContentItem[] = [];

        if (field.modular_content) {
            if (Array.isArray(field.modular_content)) {
                field.modular_content.forEach(codename => {
                    // get modular item and check if it exists (it might not be included in response due to 'Depth' parameter)
                    const modularContentItem = modularContent[codename];

                    if (!modularContentItem) {
                        throw Error(`Modular content item with codename '${codename}' is not present in Delivery response.
                        This modular item was requested by '${field.name}' field.
                        Error can usually be solved by increasing 'Depth' parameter of your query.`);
                    }

                    const modularItem = this.mapFields(modularContent[codename], modularContent, queryConfig, processedItems);

                    if (modularItem != null) {
                        modularItems.push(modularItem);
                    }
                });
            }
        }

        // extract and map links
        const links: ILink[] = this.mapRichTextLinks(field.links);

        return new Fields.RichTextField(this.richTextHtmlParser, field.name, field.value, modularItems, links, this.typeResolverService, this.config.enableAdvancedLogging, queryConfig);
    }

    private mapDateTimeField(field: FieldInterfaces.IField): Fields.DateTimeField {
        return new Fields.DateTimeField(field.name, field.value);
    }

    private mapMultipleChoiceField(field: FieldInterfaces.IField): Fields.MultipleChoiceField {
        return new Fields.MultipleChoiceField(field.name, field.value);
    }

    private mapNumberField(field: FieldInterfaces.IField): Fields.NumberField {
        return new Fields.NumberField(field.name, field.value);
    }

    private mapTextField(field: FieldInterfaces.IField): Fields.TextField {
        return new Fields.TextField(field.name, field.value);
    }

    private mapAssetsField(field: FieldInterfaces.IField): Fields.AssetsField {
        return new Fields.AssetsField(field.name, field.value);
    }

    private mapTaxonomyField(field: FieldInterfaces.IField): Fields.TaxonomyField {
        return new Fields.TaxonomyField(field.name, field.value, field.taxonomy_group);
    }

    private mapUrlSlugField(field: FieldInterfaces.IField, item: IContentItem, queryConfig: IItemQueryConfig): Fields.UrlSlugField {
        const linkResolver = this.getLinkResolverForUrlSlugField(item, queryConfig);

        return new Fields.UrlSlugField(field.name, field.value, item, linkResolver, this.config.enableAdvancedLogging);
    }

    private mapModularField(field: FieldInterfaces.IField, modularContent: any, queryConfig: IItemQueryConfig, processedItems: IContentItem[]): any {
        if (!field) {
            if (this.config.enableAdvancedLogging) {
                console.warn(`Cannot map modular content field because field does not exist`);
            }
            return null;
        }

        if (!field.value) {
            if (this.config.enableAdvancedLogging) {
                console.warn(`Cannot map modular content of '${field.name}' because its value does not exist`);
            }
            return null;
        }

        // modular content is always returned in an array
        const modularContentItems: any[] = [];
        const fieldModularContent = field.value as Array<string>;
        fieldModularContent.forEach(modularItemCodename => {
            const modularItem = modularContent[modularItemCodename];

            if (!modularItem) {
                if (this.config.enableAdvancedLogging) {
                    console.warn(`Cannot map '${field.name}' modular content item. Make sure you use 'DepthParameter' in case your modular content is nested.`)
                }
            }

            // try to map only if the modular item was present in response
            if (modularItem) {
                // add/taken item to processed items to avoid infinite recursion
                let processedItem = processedItems.find(m => m.system.codename === modularItem.system.codename);
                if (processedItem) {
                    modularContentItems.push(processedItem);
                } else {
                    const newModularItem = this.mapFields<any>(modularItem, modularContent, queryConfig, processedItems);
                    modularContentItems.push(newModularItem);
                    processedItem = newModularItem;
                }
            }
        })

        return modularContentItems;
    }

    private getLinkResolverForUrlSlugField(item: IContentItem, queryConfig: IItemQueryConfig): ((link: ILink) => string) | undefined {
        // link resolver defined by the query config (= by calling method) has priority over type's global link resolver
        let linkResolver: ((value: ILink) => string) | undefined = undefined;

        if (queryConfig.linkResolver) {
            linkResolver = queryConfig.linkResolver;
        } else {
            linkResolver = item.linkResolver;
        }

        return linkResolver;
    }

    private mapRichTextLinks(linksJson: any): ILink[] {
        const links: ILink[] = [];

        for (const linkItemId of Object.keys(linksJson)) {
            const linkRaw: ILink = linksJson[linkItemId] as ILink;
            links.push(new Link(linkItemId, linkRaw.codename, linkRaw.type, linkRaw.url_slug));
        }

        return links;
    }
}
